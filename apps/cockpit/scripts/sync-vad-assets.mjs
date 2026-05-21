import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const cockpitRoot = path.resolve(__dirname, '..')
const publicVendorRoot = path.join(cockpitRoot, 'public', 'vendor')
const generatedVoiceAssetRoot = path.join(cockpitRoot, 'src', 'widgets', 'voice', 'generated')
const manifestPath = path.join(publicVendorRoot, 'voice-vad-assets.manifest.json')
const legacyOnnxPublicAssetRoot = path.join(publicVendorRoot, 'onnxruntime-web')

const require = createRequire(import.meta.url)
const vadReactPackageJsonPath = require.resolve('@ricky0123/vad-react/package.json')
const vadReactRequire = createRequire(vadReactPackageJsonPath)

function packageRootFromPackageJson(packageJsonPath) {
  return path.dirname(packageJsonPath)
}

async function readPackageVersion(packageJsonPath) {
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))
  if (typeof packageJson.version !== 'string' || packageJson.version.length === 0) {
    throw new Error(`Package at ${packageJsonPath} does not declare a valid version.`)
  }

  return packageJson.version
}

async function resolvePackageJsonPath(packageName, resolver) {
  const entryPath = resolver.resolve(packageName)
  let currentDirectory = path.dirname(entryPath)

  while (true) {
    const packageJsonPath = path.join(currentDirectory, 'package.json')

    try {
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))
      if (packageJson.name === packageName) {
        return packageJsonPath
      }
    } catch {
      // keep walking up to the package root
    }

    const parentDirectory = path.dirname(currentDirectory)
    if (parentDirectory === currentDirectory) {
      break
    }

    currentDirectory = parentDirectory
  }

  throw new Error(`Failed to locate package.json for ${packageName}.`)
}

async function ensureFilesExist(directory, requiredFiles) {
  for (const requiredFile of requiredFiles) {
    const requiredPath = path.join(directory, requiredFile)
    try {
      await stat(requiredPath)
    } catch (error) {
      throw new Error(
        `Expected runtime asset "${requiredFile}" in ${directory}, but it was not found.`,
        { cause: error },
      )
    }
  }
}

async function copyFiles(sourceDirectory, destinationDirectory, files) {
  await rm(destinationDirectory, { force: true, recursive: true })
  await mkdir(destinationDirectory, { recursive: true })

  for (const file of files) {
    const sourcePath = path.join(sourceDirectory, file)
    const destinationPath = path.join(destinationDirectory, file)

    await mkdir(path.dirname(destinationPath), { recursive: true })
    await cp(sourcePath, destinationPath)
  }
}

async function countFiles(directory) {
  const entries = await stat(directory)
  if (!entries.isDirectory()) {
    return 0
  }

  let fileCount = 0
  const stack = [directory]

  while (stack.length > 0) {
    const currentDirectory = stack.pop()
    const children = await readdir(currentDirectory, { withFileTypes: true })

    for (const child of children) {
      const childPath = path.join(currentDirectory, child.name)
      if (child.isDirectory()) {
        stack.push(childPath)
        continue
      }

      if (child.isFile()) {
        fileCount += 1
      }
    }
  }

  return fileCount
}

async function syncPackageAssets({ destinationName, packageName, requiredFiles, resolver = require }) {
  const packageJsonPath = await resolvePackageJsonPath(packageName, resolver)
  const packageRoot = packageRootFromPackageJson(packageJsonPath)
  const version = await readPackageVersion(packageJsonPath)
  const sourceDirectory = path.join(packageRoot, 'dist')
  const destinationDirectory = path.join(cockpitRoot, destinationName)

  await ensureFilesExist(sourceDirectory, requiredFiles)
  await copyFiles(sourceDirectory, destinationDirectory, requiredFiles)
  await ensureFilesExist(destinationDirectory, requiredFiles)

  return {
    destinationDirectory,
    destinationName,
    fileCount: await countFiles(destinationDirectory),
    packageName,
    sourceDirectory,
    version,
  }
}

async function run() {
  await rm(legacyOnnxPublicAssetRoot, { force: true, recursive: true })

  const copiedPackages = await Promise.all([
    syncPackageAssets({
      destinationName: path.join('public', 'vendor', 'vad'),
      packageName: '@ricky0123/vad-web',
      requiredFiles: ['silero_vad_legacy.onnx', 'silero_vad_v5.onnx', 'vad.worklet.bundle.min.js'],
      resolver: vadReactRequire,
    }),
    syncPackageAssets({
      destinationName: path.join('src', 'widgets', 'voice', 'generated', 'onnxruntime-web'),
      packageName: 'onnxruntime-web',
      requiredFiles: ['ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm'],
      resolver: vadReactRequire,
    }),
  ])

  const manifest = {
    copiedAt: new Date().toISOString(),
    packages: copiedPackages.map((copiedPackage) => ({
      destinationDirectory: path.relative(cockpitRoot, copiedPackage.destinationDirectory),
      destinationName: copiedPackage.destinationName,
      fileCount: copiedPackage.fileCount,
      packageName: copiedPackage.packageName,
      sourceDirectory: path.relative(cockpitRoot, copiedPackage.sourceDirectory),
      version: copiedPackage.version,
    })),
  }

  await mkdir(publicVendorRoot, { recursive: true })
  await mkdir(generatedVoiceAssetRoot, { recursive: true })
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  for (const copiedPackage of copiedPackages) {
    console.log(
      `Synced ${copiedPackage.packageName}@${copiedPackage.version} -> ${path.relative(cockpitRoot, copiedPackage.destinationDirectory)} (${copiedPackage.fileCount} files)`,
    )
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
