'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DocentesPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/directivo/dashboard')
  }, [])
  return null
}
