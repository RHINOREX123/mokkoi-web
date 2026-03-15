import { Sidebar } from './components/Sidebar'
import { PhoneFrame } from './components/PhoneFrame'
import { TokenPanel } from './components/TokenPanel'
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

  return (
    <div className="h-screen w-screen flex bg-mokkoi-bg">
      <Sidebar
        screens={screens}
        selectedScreenId={selectedScreenId}
        onSelectScreen={setSelectedScreenId}
        status={status}
      />

      <PhoneFrame screen={selectedScreen} />

      <TokenPanel tokens={tokens} />
    </div>
  )
}

export default App
