This minimal reproduction example has been created by following these steps:

1. Init app & add dependencies
```bash
npx create-next-app web3.storage-vercel-bug
pnpm add @ipld/car @ucanto/core @ucanto/principal @web3-storage/access @web3-storage/w3up-client busboy
```

2. Add pages/api/web3storage.ts
```typescript
import { NextApiRequest, NextApiResponse, type NextApiHandler } from 'next'
import { create, type Client } from '@web3-storage/w3up-client'
import { StoreMemory } from '@web3-storage/access/stores/store-memory'
import { importDAG } from '@ucanto/core/delegation'
import type { API } from '@ucanto/core'
import { parse, type Block } from '@ucanto/principal/ed25519'
import type { Filelike } from 'web3.storage'
import { CarReader } from '@ipld/car'
import busboy, { type FileInfo } from 'busboy'
import { type Readable } from 'stream'

export interface InfuraAddResponse {
  Name: string
  Hash: string
  Size: string
}

const handler: NextApiHandler = async (req, res) => {
  const files = await getFilesFromBody(req)
  const cid = await uploadFileToWeb3Storage(files[0], req, res)

  res.json({
    filename: files[0].name,
    cid
  })
}

export default handler

export const config = {
  api: {
    bodyParser: false
  }
}
const uploadFileToWeb3Storage = async (
  file: Filelike,
  req: NextApiRequest,
  res: NextApiResponse
): Promise<string | undefined> => {
  const client = await loadWeb3StorageClient()
  const web3StorageResponse = await client.uploadFile(file)
  const cid = web3StorageResponse.toString()
  return cid
}
const parseWeb3StorageProof = async (
  data: string // Base64 encoded CAR file
): Promise<API.Delegation<API.Capabilities>> => {
  const blocks = []
  const reader = await CarReader.fromBytes(Buffer.from(data, 'base64'))
  for await (const block of reader.blocks()) {
    blocks.push(block)
  }
  return importDAG(blocks as Iterable<Block<unknown, number, number, 1>>)
}

const loadWeb3StorageClient = async (): Promise<Client> => {
  // Load client with specific private key
  const principal = parse(process.env.WEB3_STORAGE_KEY as string)
  const client = await create({
    principal,
    store: new StoreMemory()
  })
  // Add proof that this agent has been delegated capabilities on the space
  const proof = await parseWeb3StorageProof(
    process.env.WEB3_STORAGE_PROOF as string
  )
  const space = await client.addSpace(proof)
  await client.setCurrentSpace(space.did())
  return client
}

const getFilesFromBody = async (req: NextApiRequest): Promise<File[]> => {
  const bb = busboy({ headers: req.headers })
  const files = await new Promise<File[]>((resolve, reject) => {
    const _files: File[] = []
    bb.on('file', (_field: string, file: Readable, info: FileInfo) => {
      const { filename } = info
      const buffers: Buffer[] = []
      file
        .on('data', (chunk: ArrayBuffer) => {
          buffers.push(Buffer.from(chunk))
        })
        .on('end', () =>
          _files.push({
            name: filename,
            stream: () => new Blob([Buffer.concat(buffers)]).stream(),
            size: Buffer.concat(buffers).length,
            lastModified: Date.now(),
            webkitRelativePath: '',
            type: '',
            slice: (start?: number, end?: number, contentType?: string): Blob =>
              new Blob([Buffer.concat(buffers.slice(start, end))], {
                type: contentType
              }),
            arrayBuffer: async () =>
              await Promise.resolve(Buffer.concat(buffers).buffer),
            text: async () =>
              await Promise.resolve(Buffer.concat(buffers).toString())
          } as File)
        )
    })
      .on('finish', () => {
        resolve(_files)
      })
      .on('error', (err: Error) => {
        reject(err)
      })
    req.pipe(bb)
  })
  return files
}

```

3. Add pages/index.tsx
```typescript
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
``````

3. Deploy on vercel with the following environment variables:
```
WEB3_STORAGE_KEY: <private key>
WEB3_STORAGE_PROOF: <proof>
```

4. Upload any file on the deployed app.

5. Check vercel logs. You should see the following 405 error:

```
TypeError: Cannot add property x-vercel-id, object is not extensible

    at X (/var/task/___vc/__launcher/bridge-server-72TT5FOD.js:1:6045)

    at Object.mutateHeaders (/var/task/___vc/__launcher/bridge-server-72TT5FOD.js:2:1032)

    at /var/task/___vc/__launcher/bridge-server-72TT5FOD.js:1:887

    at /var/task/___vc/__launcher/bridge-server-72TT5FOD.js:1:4769

    at _optionalChain (/var/task/___vc/__launcher/bridge-server-72TT5FOD.js:1:865)

    at d (/var/task/___vc/__launcher/bridge-server-72TT5FOD.js:1:4691)

    at Channel.request (file:///var/task/node_modules/.pnpm/@ucanto+transport@9.0.0/node_modules/@ucanto/transport/src/http.js:60:33)

    at execute (file:///var/task/node_modules/.pnpm/@ucanto+client@9.0.0/node_modules/@ucanto/client/src/connection.js:50:45)

    at async IssuedInvocation.execute (file:///var/task/node_modules/.pnpm/@ucanto+core@9.0.1/node_modules/@ucanto/core/src/invocation.js:115:22)

    at async retry.onFailedAttempt (file:///var/task/node_modules/.pnpm/@web3-storage+upload-client@13.0.0/node_modules/@web3-storage/upload-client/dist/src/store.js:52:16)

 ⨯ TypeError: Cannot add property x-vercel-id, object is not extensible

    at X (/var/task/___vc/__launcher/bridge-server-72TT5FOD.js:1:6045)

    at Object.mutateHeaders (/var/task/___vc/__launcher/bridge-server-72TT5FOD.js:2:1032)

    at /var/task/___vc/__launcher/bridge-server-72TT5FOD.js:1:887

    at /var/task/___vc/__launcher/bridge-server-72TT5FOD.js:1:4769

    at _optionalChain (/var/task/___vc/__launcher/bridge-server-72TT5FOD.js:1:865)

    at d (/var/task/___vc/__launcher/bridge-server-72TT5FOD.js:1:4691)

    at Channel.request (file:///var/task/node_modules/.pnpm/@ucanto+transport@9.0.0/node_modules/@ucanto/transport/src/http.js:60:33)

    at execute (file:///var/task/node_modules/.pnpm/@ucanto+client@9.0.0/node_modules/@ucanto/client/src/connection.js:50:45)

    at async IssuedInvocation.execute (file:///var/task/node_modules/.pnpm/@ucanto+core@9.0.1/node_modules/@ucanto/core/src/invocation.js:115:22)

    at async retry.onFailedAttempt (file:///var/task/node_modules/.pnpm/@web3-storage+upload-client@13.0.0/node_modules/@web3-storage/upload-client/dist/src/store.js:52:16)

TypeError: Cannot add property x-vercel-id, object is not extensible

    at X (/var/task/___vc/__launcher/bridge-server-72TT5FOD.js:1:6045)

    at Object.mutateHeaders (/var/task/___vc/__launcher/bridge-server-72TT5FOD.js:2:1032)

    at /var/task/___vc/__launcher/bridge-server-72TT5FOD.js:1:887

    at /var/task/___vc/__launcher/bridge-server-72TT5FOD.js:1:4769

    at _optionalChain (/var/task/___vc/__launcher/bridge-server-72TT5FOD.js:1:865)

    at d (/var/task/___vc/__launcher/bridge-server-72TT5FOD.js:1:4691)

    at Channel.request (file:///var/task/node_modules/.pnpm/@ucanto+transport@9.0.0/node_modules/@ucanto/transport/src/http.js:60:33)

    at execute (file:///var/task/node_modules/.pnpm/@ucanto+client@9.0.0/node_modules/@ucanto/client/src/connection.js:50:45)

    at async IssuedInvocation.execute (file:///var/task/node_modules/.pnpm/@ucanto+core@9.0.1/node_modules/@ucanto/core/src/invocation.js:115:22)

    at async retry.onFailedAttempt (file:///var/task/node_modules/.pnpm/@web3-storage+upload-client@13.0.0/node_modules/@web3-storage/upload-client/dist/src/store.js:52:16)

Error: Runtime exited without providing a reason

Runtime.ExitError
```


## Getting Started

To run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
