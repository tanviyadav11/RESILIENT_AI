import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Login.css';

const Login = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        mobile: '',
        password: '',
        confirmPassword: '',
        role: 'citizen'
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError('');
    };

    const handleRoleSelect = (role) => {
        setFormData({
            ...formData,
            role
        });
    };

    const validateForm = () => {
        if (!isLogin) {
            if (!formData.name.trim()) {
                setError('Name is required');
                return false;
            }
            if (!formData.mobile.trim() || formData.mobile.length < 10) {
                setError('Valid mobile number is required');
                return false;
            }
            if (formData.password !== formData.confirmPassword) {
                setError('Passwords do not match');
                return false;
            }
            if (formData.password.length < 6) {
                setError('Password must be at least 6 characters');
                return false;
            }
        }
        if (!formData.email.trim() || !formData.password.trim()) {
            setError('All fields are required');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setLoading(true);
        setError('');

        try {
            if (isLogin) {
                // Login
                const { data } = await api.post('/auth/login', {
                    identifier: formData.email, // Using email field as generic identifier
                    password: formData.password
                });
                localStorage.setItem('userInfo', JSON.stringify(data));

                // Redirect: Citizens to dashboard, Authorities to admin
                if (data.role === 'citizen') {
                    navigate('/dashboard');
                } else {
                    navigate('/admin');
                }
            } else {
                // Register
                const { data } = await api.post('/auth/register', {
                    name: formData.name,
                    email: formData.email,
                    mobile: formData.mobile,
                    password: formData.password,
                    role: formData.role
                });
                localStorage.setItem('userInfo', JSON.stringify(data));

                // Redirect: Citizens to dashboard, Authorities to admin
                if (data.role === 'citizen') {
                    navigate('/dashboard');
                } else {
                    navigate('/admin');
                }
            }
        } catch (err) {
            console.error('=== Registration/Login Error ===');
            console.error('Full error:', err);
            console.error('Response:', err.response);
            console.error('Response data:', err.response?.data);

            // Check if it's a network error (server not reachable)
            if (!err.response) {
                setError('Cannot connect to server. Please ensure the backend is running on http://localhost:5000');
            } else {
                // Show specific error from backend
                const errorMessage = err.response?.data?.message || err.response?.data?.error || 'An error occurred. Please try again.';
                setError(errorMessage);
            }
        } finally {
            setLoading(false);
        }
    };

    const toggleMode = () => {
        setIsLogin(!isLogin);
        setError('');
        setFormData({
            name: '',
            email: '',
            mobile: '',
            password: '',
            confirmPassword: '',
            role: 'citizen'
        });
    };

    return (
        <div className="login-container">
            <div className="login-wrapper">
                <div className="login-card">
                    {/* Header */}
                    <div className="login-header">
                        <h1>{isLogin ? 'Welcome Back' : 'Create Account'}</h1>
                        <p>{isLogin ? 'Sign in to access your dashboard' : 'Register to get started'}</p>
                    </div>

                    {/* Role Selection */}
                    <div className="role-selection">
                        <h3>I am a:</h3>
                        <div className="role-cards">
                            <div
                                className={`role-card ${formData.role === 'citizen' ? 'active' : ''}`}
                                onClick={() => handleRoleSelect('citizen')}
                            >
                                <div className="role-icon">👤</div>
                                <h4>Citizen</h4>
                                <p>Report emergencies and request help</p>
                            </div>
                            <div
                                className={`role-card ${formData.role === 'authority' ? 'active' : ''}`}
                                onClick={() => handleRoleSelect('authority')}
                            >
                                <div className="role-icon">🚨</div>
                                <h4>Authority</h4>
                                <p>Respond to emergencies and manage requests</p>
                            </div>
                        </div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="login-form">
                        {!isLogin && (
                            <div className="form-group">
                                <label>Full Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Enter your full name"
                                    disabled={loading}
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label>{isLogin ? 'Email or Mobile Number' : 'Email Address'}</label>
                            <input
                                type="text"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder={isLogin ? "Enter email or mobile" : "Enter your email"}
                                disabled={loading}
                            />
                        </div>

                        {!isLogin && (
                            <div className="form-group">
                                <label>Mobile Number</label>
                                <input
                                    type="text"
                                    name="mobile"
                                    value={formData.mobile}
                                    onChange={handleChange}
                                    placeholder="Enter your mobile number"
                                    disabled={loading}
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label>Password</label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="Enter your password"
                                disabled={loading}
                            />
                        </div>

                        {!isLogin && (
                            <div className="form-group">
                                <label>Confirm Password</label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="Confirm your password"
                                    disabled={loading}
                                />
                            </div>
                        )}

                        {error && (
                            <div className="error-message">
                                ⚠️ {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn-submit"
                            disabled={loading}
                        >
                            {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
                        </button>
                    </form>

                    {/* Toggle Mode */}
                    <div className="toggle-mode">
                        <p>
                            {isLogin ? "Don't have an account? " : "Already have an account? "}
                            <span onClick={toggleMode} className="toggle-link">
                                {isLogin ? 'Register here' : 'Sign in here'}
                            </span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
