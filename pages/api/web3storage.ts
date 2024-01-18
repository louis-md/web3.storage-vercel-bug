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
