from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path
from uuid import uuid4

from .assets import AssetStore
from .compiler import compile_skill
from .config import MAX_PACKAGE_BYTES
from .models import StyleProfile, now


class NotFoundError(ValueError):
    pass


class ConflictError(ValueError):
    pass


class Library:
    def __init__(self, root: Path, assets: AssetStore):
        root.mkdir(parents=True, exist_ok=True)
        self.db_path = root / "styledna.sqlite3"
        self.assets = assets
        self.lock = threading.RLock()
        with self.connect() as db:
            db.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY);
                CREATE TABLE IF NOT EXISTS skills(
                    id TEXT PRIMARY KEY, profile TEXT NOT NULL, markdown TEXT NOT NULL,
                    revision INTEGER NOT NULL, name TEXT NOT NULL, search TEXT NOT NULL,
                    category TEXT NOT NULL, favorite INTEGER NOT NULL, updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS skills_updated ON skills(updated_at DESC);
                CREATE INDEX IF NOT EXISTS skills_category ON skills(category, favorite);
                CREATE INDEX IF NOT EXISTS skills_name ON skills(name COLLATE NOCASE);
                CREATE TABLE IF NOT EXISTS revisions(
                    skill_id TEXT REFERENCES skills(id) ON DELETE CASCADE,
                    revision INTEGER NOT NULL, profile TEXT NOT NULL, markdown TEXT NOT NULL,
                    created_at TEXT NOT NULL, PRIMARY KEY(skill_id, revision)
                );
                CREATE TABLE IF NOT EXISTS revision_assets(
                    skill_id TEXT NOT NULL, revision INTEGER NOT NULL, asset_id TEXT NOT NULL,
                    PRIMARY KEY(skill_id, revision, asset_id),
                    FOREIGN KEY(skill_id, revision) REFERENCES revisions(skill_id, revision)
                    ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS refs_asset ON revision_assets(asset_id);
                CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, payload TEXT NOT NULL);
                INSERT OR IGNORE INTO migrations VALUES(1);
            """)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.db_path, timeout=15)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        try:
            with db:
                yield db
        finally:
            db.close()

    def get(self, skill_id: str, revision: int | None = None) -> dict:
        with self.connect() as db:
            if revision is None:
                row = db.execute("SELECT * FROM skills WHERE id=?", (skill_id,)).fetchone()
            else:
                row = db.execute(
                    "SELECT * FROM revisions WHERE skill_id=? AND revision=?", (skill_id, revision)
                ).fetchone()
        if row is None:
            raise NotFoundError("Skill or revision no longer exists")
        return {
            "profile": json.loads(row["profile"]),
            "revision": row["revision"],
            "markdown": row["markdown"],
        }

    def save(self, profile: StyleProfile, expected_revision: int) -> dict:
        profile = StyleProfile.model_validate(profile.model_dump())
        with self.lock, self.connect() as db:
            current = db.execute(
                "SELECT revision,profile FROM skills WHERE id=?", (profile.id,)
            ).fetchone()
            actual = current["revision"] if current else 0
            if actual != expected_revision:
                raise ConflictError("This skill changed or was deleted. Reload it before saving.")
            reference_bytes = sum(self.assets.get(ref_id).bytes for ref_id in profile.reference_ids)
            profile.updated_at = now()
            profile.created_at = json.loads(current["profile"])["created_at"] if current else now()
            payload = profile.model_dump_json()
            markdown = compile_skill(profile)
            # Reserve bounded manifest/ZIP overhead so every accepted revision can be backed up.
            package_bytes = reference_bytes + len(profile.model_dump_json(indent=2).encode("utf-8"))
            package_bytes += len(markdown.encode("utf-8")) + 64_000
            if package_bytes > MAX_PACKAGE_BYTES:
                raise ValueError(
                    "This style exceeds the portable package budget. Remove or resize references before saving."
                )
            revision = actual + 1
            search = " ".join(
                [profile.name, profile.description, profile.category, *profile.tags]
            ).lower()
            db.execute(
                """INSERT INTO skills VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
                       profile=excluded.profile,markdown=excluded.markdown,revision=excluded.revision,
                       name=excluded.name,search=excluded.search,category=excluded.category,
                       favorite=excluded.favorite,updated_at=excluded.updated_at""",
                (
                    profile.id,
                    payload,
                    markdown,
                    revision,
                    profile.name,
                    search,
                    profile.category,
                    profile.favorite,
                    profile.updated_at,
                ),
            )
            db.execute(
                "INSERT INTO revisions VALUES(?,?,?,?,?)",
                (profile.id, revision, payload, markdown, profile.updated_at),
            )
            db.executemany(
                "INSERT INTO revision_assets VALUES(?,?,?)",
                [(profile.id, revision, ref) for ref in profile.reference_ids],
            )
        return {"profile": profile.model_dump(), "revision": revision, "markdown": markdown}

    def list(self, query="", category="", tag="", favorite=False, offset=0, limit=24) -> dict:
        where, values = ["1=1"], []
        if query:
            where.append("instr(search, ?) > 0")
            values.append(query.lower())
        if category:
            where.append("category=?")
            values.append(category)
        if favorite:
            where.append("favorite=1")
        # JSON table values avoid substring matches between distinct tags.
        if tag:
            where.append("EXISTS(SELECT 1 FROM json_each(profile, '$.tags') WHERE value=?)")
            values.append(tag)
        clause = " AND ".join(where)
        with self.connect() as db:
            total = db.execute(f"SELECT COUNT(*) FROM skills WHERE {clause}", values).fetchone()[0]
            rows = db.execute(
                f"SELECT profile,revision FROM skills WHERE {clause} "
                "ORDER BY updated_at DESC,id LIMIT ? OFFSET ?",
                [*values, min(max(limit, 1), 48), max(offset, 0)],
            ).fetchall()
            facets = db.execute("SELECT DISTINCT category FROM skills ORDER BY category").fetchall()
            tags = db.execute(
                "SELECT DISTINCT j.value FROM skills, json_each(profile,'$.tags') j "
                "ORDER BY j.value"
            ).fetchall()
        keys = (
            "id",
            "name",
            "description",
            "category",
            "tags",
            "favorite",
            "updated_at",
            "reference_ids",
            "palette",
        )
        return {
            "items": [
                {**{k: json.loads(r["profile"])[k] for k in keys}, "revision": r["revision"]}
                for r in rows
            ],
            "total": total,
            "categories": [r[0] for r in facets],
            "tags": [r[0] for r in tags],
        }

    def revisions(self, skill_id: str) -> list[dict]:
        self.get(skill_id)
        with self.connect() as db:
            rows = db.execute(
                "SELECT revision,created_at,profile FROM revisions WHERE skill_id=? "
                "ORDER BY revision DESC",
                (skill_id,),
            ).fetchall()
        return [
            {
                "revision": r["revision"],
                "created_at": r["created_at"],
                "name": json.loads(r["profile"])["name"],
            }
            for r in rows
        ]

    def restore(self, skill_id: str, revision: int, expected_revision: int) -> dict:
        old = StyleProfile.model_validate(self.get(skill_id, revision)["profile"])
        return self.save(old, expected_revision)

    def duplicate(self, skill_id: str) -> dict:
        p = StyleProfile.model_validate(self.get(skill_id)["profile"])
        p.id = uuid4().hex
        p.name = p.name[:113] + " (copy)"
        p.favorite = False
        return self.save(p, 0)

    def delete(self, skill_id: str) -> None:
        with self.lock:
            self.get(skill_id)
            with self.connect() as db:
                refs = [
                    r[0]
                    for r in db.execute(
                        "SELECT DISTINCT asset_id FROM revision_assets WHERE skill_id=?",
                        (skill_id,),
                    )
                ]
                db.execute("DELETE FROM skills WHERE id=?", (skill_id,))
            with self.connect() as db:
                unused = [
                    ref
                    for ref in refs
                    if not db.execute(
                        "SELECT 1 FROM revision_assets WHERE asset_id=? LIMIT 1", (ref,)
                    ).fetchone()
                ]
            for ref in unused:
                self.assets.remove(ref)

    def settings(self) -> dict:
        with self.connect() as db:
            return {r["key"]: json.loads(r["value"]) for r in db.execute("SELECT * FROM settings")}

    def update_settings(self, values: dict) -> dict:
        with self.connect() as db:
            db.executemany(
                "INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE "
                "SET value=excluded.value",
                [(k, json.dumps(v)) for k, v in values.items()],
            )
        return self.settings()

    def put_job(self, job: dict) -> None:
        with self.connect() as db:
            db.execute(
                "INSERT INTO jobs VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
                (job["id"], json.dumps(job)),
            )

    def get_job(self, job_id: str) -> dict:
        with self.connect() as db:
            row = db.execute("SELECT payload FROM jobs WHERE id=?", (job_id,)).fetchone()
        if not row:
            raise NotFoundError("Analysis job no longer exists")
        return json.loads(row[0])

    def interrupt_jobs(self) -> None:
        with self.connect() as db:
            rows = db.execute("SELECT payload FROM jobs").fetchall()
            for row in rows:
                job = json.loads(row[0])
                if job["state"] in ("queued", "running"):
                    job.update(
                        state="interrupted", error="App closed during analysis. Please retry."
                    )
                    db.execute("UPDATE jobs SET payload=? WHERE id=?", (json.dumps(job), job["id"]))
