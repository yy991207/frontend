import { createContext, useContext, useState, type ReactNode } from 'react'

export type ArtifactFile = {
  filepath: string
  sessionId?: string
  baseUrl?: string
}

interface ArtifactsContextType {
  files: ArtifactFile[]
  addFile: (file: ArtifactFile) => void
  selectedFile: ArtifactFile | null
  selectFile: (file: ArtifactFile | null) => void
  open: boolean
  setOpen: (open: boolean) => void
}

const ArtifactsContext = createContext<ArtifactsContextType | undefined>(undefined)

interface ArtifactsProviderProps {
  children: ReactNode
}

export function ArtifactsProvider({ children }: ArtifactsProviderProps) {
  const [files, setFiles] = useState<ArtifactFile[]>([])
  const [selectedFile, setSelectedFile] = useState<ArtifactFile | null>(null)
  const [open, setOpen] = useState(false)

  const value: ArtifactsContextType = {
    files,
    addFile: (file) => {
      setFiles((prev) => {
        if (prev.some((f) => f.filepath === file.filepath)) {
          return prev
        }
        return [...prev, file]
      })
    },
    selectedFile,
    selectFile: (file) => {
      setSelectedFile(file)
      if (file) {
        setOpen(true)
      }
    },
    open,
    setOpen,
  }

  return (
    <ArtifactsContext.Provider value={value}>
      {children}
    </ArtifactsContext.Provider>
  )
}

export function useArtifacts() {
  const context = useContext(ArtifactsContext)
  if (context === undefined) {
    throw new Error('useArtifacts must be used within an ArtifactsProvider')
  }
  return context
}
