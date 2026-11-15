import { useEffect, useState } from 'react'
import { ImageIcon } from 'lucide-react'
import { request } from '../lib/api'

// Reference-counted object URLs keep authorization off image URLs and cap decoded assets.
const cache = new Map<
  string,
  { promise: Promise<string>; users: number; url?: string; timer?: ReturnType<typeof setTimeout> }
>()

export function AssetImage({
  id,
  alt,
  variant = 'thumbnail',
  className = '',
}: {
  id: string
  alt: string
  variant?: 'thumbnail' | 'preview'
  className?: string
}) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState(false)
  useEffect(() => {
    const key = `${id}/${variant}`
    let entry = cache.get(key)
    if (!entry) {
      entry = {
        users: 0,
        promise: request(`/api/assets/${key}`)
          .then((r) => r.blob())
          .then((blob) => {
            const url = URL.createObjectURL(blob)
            const current = cache.get(key)
            if (current) current.url = url
            return url
          }),
      }
      cache.set(key, entry)
    }
    clearTimeout(entry.timer)
    entry.users++
    let active = true
    setUrl('')
    setError(false)
    entry.promise
      .then((value) => {
        if (active) setUrl(value)
      })
      .catch(() => {
        if (active) setError(true)
      })
    return () => {
      active = false
      entry!.users--
      if (!entry!.users)
        entry!.timer = setTimeout(() => {
          if (entry!.url) URL.revokeObjectURL(entry!.url)
          else entry!.promise.then(URL.revokeObjectURL).catch(() => {})
          cache.delete(key)
        }, 1000)
    }
  }, [id, variant])
  return url ? (
    <img src={url} alt={alt} className={className} loading="lazy" />
  ) : (
    <div
      className={`image-fallback ${className}`}
      role="img"
      aria-label={error ? `${alt}: unavailable` : `Loading ${alt}`}
    >
      <ImageIcon size={24} />
    </div>
  )
}
