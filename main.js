// This must be the first import
import 'dotenv/config'

import assert from 'node:assert'
import { Synapse, RPC_URLS } from '@filoz/synapse-sdk'

const { GLIF_TOKEN, PRIVATE_KEY } = process.env

assert(!!PRIVATE_KEY, 'PRIVATE_KEY is required. Set it in .env file.')

console.log('Initialised Synapse SDK...')
const synapse = await Synapse.create({
  privateKey: PRIVATE_KEY,
  rpcURL: RPC_URLS.calibration.http,
  authorization: GLIF_TOKEN ? `Bearer ${GLIF_TOKEN}` : undefined,
  withCDN: true,
})

console.log('Creating storage service...')
const storage = await synapse.createStorage({
  callbacks: {
    onProviderSelected: (provider) => {
      console.log(`✓ Selected storage provider: ${provider.owner}`)
      console.log(`  PDP URL: ${provider.pdpUrl}`)
    },
    onProofSetResolved: (info) => {
      if (info.isExisting) {
        console.log(`✓ Using existing proof set: ${info.proofSetId}`)
      } else {
        console.log(`✓ Created new proof set: ${info.proofSetId}`)
      }
    },
    onProofSetCreationStarted: (transaction, statusUrl) => {
      console.log(`  Creating proof set, tx: ${transaction.hash}`)
    },
    onProofSetCreationProgress: (progress) => {
      if (progress.transactionMined && !progress.proofSetLive) {
        console.log('  Transaction mined, waiting for proof set to be live...')
      }
    },
  },
})

const fileData = new TextEncoder().encode(
  '🚀 Welcome to decentralized storage on Filecoin! Your data is safe here. 🌍',
)

// Run preflight checks
const preflight = await storage.preflightUpload(fileData.length)
if (!preflight.allowanceCheck.sufficient) {
  // The Filecoin Services deal is not sufficient
  // You need to increase the allowance, e.g. via the web app
  throw new Error('Allowance not sufficient.')
}

console.log('Uploading content...')

// Upload data
const uploadResult = await storage.upload(fileData)
console.log(`Upload complete! CommP: ${uploadResult.commp}`)

const url = `https://${await synapse.getSigner().getAddress()}.calibration.filcdn.io/${uploadResult.commp}`
console.log('Fetching', url)
const res = await fetch(url)
console.log('Response:', res.status, res.statusText)

// Download data from this provider
console.log('Downloading from provider...')
const data = await storage.providerDownload(uploadResult.commp)
console.log('Retrieved:', new TextDecoder().decode(data))

// Or download from any provider that has the piece
const dataFromAny = await synapse.download(uploadResult.commp)
console.log('DATA FROM ANY', new TextDecoder().decode(dataFromAny))
