import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar/Sidebar'
import HomePage from './pages/Home/HomePage'
import LibraryPage from './pages/Library/LibraryPage'
import SkillsPage from './pages/Skills/SkillsPage'

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar />
        <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/skills" element={<SkillsPage />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}
