import { ChangeEvent } from 'react'

export default function Home () {
  const handleFileChange: (
    e: ChangeEvent<HTMLInputElement>
  ) => Promise<void> = async e => {
    if (e.target?.files?.[0] != null) {
      const body = new FormData()
      for (const file of e.target.files) {
        body.append('file', file)
      }
      const res = await fetch('/api/web3storage', { method: 'POST', body })
      const document = await res.json()
      console.log('Uploaded: ', document.cid)
    }
  }
  return <input type='file' onChange={handleFileChange} />
}
