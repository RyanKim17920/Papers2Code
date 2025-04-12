// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import PaperListPage from './pages/PaperListPage';
import PaperDetailPage from './pages/PaperDetailPage';
import logo from './images/papers2codelogo.png'; // Import the logo
import './App.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <header className="app-header">
          <Link to="/" className="logo-link">
            {/* Use the imported logo */}
            <img src={logo} alt="Papers To Code Community Logo" className="app-logo" height="40" />
          </Link>
          <nav>
            {/* Add Nav links here later: Login, Profile, etc. */}
            {/* <Link to="/submit">Submit Paper</Link> */}
            {/* <Link to="/profile">Profile</Link> */}
          </nav>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<PaperListPage />} />
            <Route path="/paper/:paperId" element={<PaperDetailPage />} />
            <Route path="*" element={<NotFoundPage />} /> {/* Catch-all for 404 */}
          </Routes>
        </main>

        <footer className="app-footer">
          <p>© {new Date().getFullYear()} Papers2Code Community. Data sourced from <a href="https://paperswithcode.com/">PapersWithCode</a>.</p>
        </footer>
      </div>
    </Router>
  );
}

// Simple 404 component (keep as is)
const NotFoundPage: React.FC = () => {
    return (
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
            <h2>404 - Page Not Found</h2>
            <p>Sorry, the page you are looking for does not exist.</p>
            <Link to="/">Go back to the homepage</Link>
        </div>
    );
}

export default App;