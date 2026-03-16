import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { PhoneFrame } from './components/PhoneFrame'
import { TokenPanel } from './components/TokenPanel'
import { ChatInput } from './components/ChatInput'
import { useMokkoiSocket } from './hooks/useMokkoiSocket'

function App() {
  const {
    screens,
    tokens,
    status,
    selectedScreen,
    selectedScreenId,
    setSelectedScreenId,
  } = useMokkoiSocket()

  const [generatedScreenKey, setGeneratedScreenKey] = useState<string | undefined>()
  const [isGenerating, setIsGenerating] = useState(false)

  const handleScreenGenerated = (screenKey: string) => {
    if (screenKey === '__generating__') {
      setIsGenerating(true)
      setGeneratedScreenKey(undefined)
    } else {
      setIsGenerating(false)
      setGeneratedScreenKey(screenKey)
    }
  }

  return (
    <div className="app-shell h-screen w-screen flex bg-mokkoi-bg">
      <Sidebar
        screens={screens}
        selectedScreenId={selectedScreenId}
        onSelectScreen={setSelectedScreenId}
        status={status}
      />

      {/* Center panel: chat history + phone + chat input */}
      <div className="flex-1 flex flex-col items-center py-6 overflow-hidden">
        <div className="flex-1 flex items-center justify-center min-h-0">
          <PhoneFrame
            screen={selectedScreen}
            generatedScreenKey={generatedScreenKey}
            isGenerating={isGenerating}
          />
        </div>

        <div className="w-full px-6 pt-4 pb-2">
          <ChatInput onScreenGenerated={handleScreenGenerated} />
        </div>
      </div>

      <TokenPanel tokens={tokens} />
    </div>
  )
}

export default App
