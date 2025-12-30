import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import Home from './pages/Home';
import SOSSubmission from './pages/SOSSubmission';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import CitizenDashboard from './pages/CitizenDashboard';
import Alerts from './pages/Alerts';
import Shelters from './pages/Shelters';
import Splash from './pages/Splash';
import Profile from './pages/Profile';
import Layout from './components/Layout';

function App() {
    return (
        <ThemeProvider>
            <LanguageProvider>
                <Router>
                    <Routes>
                        {/* Splash screen without Layout */}
                        <Route path="/" element={<Splash />} />

                        {/* All other routes with Layout */}
                        <Route path="/*" element={
                            <Layout>
                                <Routes>
                                    <Route path="/home" element={<Home />} />
                                    <Route path="/dashboard" element={<CitizenDashboard />} />
                                    <Route path="/sos" element={<SOSSubmission />} />
                                    <Route path="/alerts" element={<Alerts />} />
                                    <Route path="/shelters" element={<Shelters />} />
                                    <Route path="/login" element={<Login />} />
                                    <Route path="/admin" element={<AdminDashboard />} />
                                    <Route path="/profile" element={<Profile />} />
                                </Routes>
                            </Layout>
                        } />
                    </Routes>
                </Router>
            </LanguageProvider>
        </ThemeProvider>
    );
}

export default App;
