import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';
import './Login.css';

const Login = () => {
    const { t } = useLanguage();
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
                setError(t('nameRequired') || 'Name is required');
                return false;
            }
            if (!formData.mobile.trim() || formData.mobile.length < 10) {
                setError(t('mobileRequired') || 'Valid mobile number is required');
                return false;
            }
            if (formData.password !== formData.confirmPassword) {
                setError(t('passwordMismatch') || 'Passwords do not match');
                return false;
            }
            if (formData.password.length < 6) {
                setError(t('passwordLength') || 'Password must be at least 6 characters');
                return false;
            }
        }
        if (!formData.email.trim() || !formData.password.trim()) {
            setError(t('fieldsRequired') || 'All fields are required');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setLoading(true);
        setError('');

        const email = formData.email.trim();
        const password = formData.password.trim();
        const name = formData.name.trim();
        const mobile = formData.mobile.trim();
        const role = formData.role;

        try {
            if (isLogin) {
                // Login
                const { data } = await api.post('/auth/login', {
                    identifier: email, // Using email field as generic identifier
                    password: password
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
                    name,
                    email,
                    mobile,
                    password,
                    role
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
                setError(t('serverError') || 'Cannot connect to server. Please ensure the backend is running on http://localhost:5000');
            } else {
                // Show specific error from backend
                const errorMessage = err.response?.data?.message || err.response?.data?.error || t('genericError') || 'An error occurred. Please try again.';
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
                        <h1>{isLogin ? t('welcomeBack') : t('createAccount')}</h1>
                        <p>{isLogin ? t('signInToAccess') : t('registerToGetStarted')}</p>
                    </div>

                    {/* Role Selection */}
                    <div className="role-selection">
                        <h3>{t('iAmA')}</h3>
                        <div className="role-cards">
                            <div
                                className={`role-card ${formData.role === 'citizen' ? 'active' : ''}`}
                                onClick={() => handleRoleSelect('citizen')}
                            >
                                <div className="role-icon">👤</div>
                                <h4>{t('citizen')}</h4>
                                <p>{t('citizenRoleDesc')}</p>
                            </div>
                            <div
                                className={`role-card ${formData.role === 'authority' ? 'active' : ''}`}
                                onClick={() => handleRoleSelect('authority')}
                            >
                                <div className="role-icon">🚨</div>
                                <h4>{t('authority')}</h4>
                                <p>{t('authorityRoleDesc')}</p>
                            </div>
                        </div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="login-form">
                        {!isLogin && (
                            <div className="form-group">
                                <label>{t('name')}</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder={t('enterFullName')}
                                    disabled={loading}
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label>{isLogin ? t('emailOrMobile') : t('emailAddress')}</label>
                            <input
                                type="text"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder={isLogin ? t('enterEmailOrMobile') : t('enterEmail')}
                                disabled={loading}
                            />
                        </div>

                        {!isLogin && (
                            <div className="form-group">
                                <label>{t('mobileNumber')}</label>
                                <input
                                    type="text"
                                    name="mobile"
                                    value={formData.mobile}
                                    onChange={handleChange}
                                    placeholder={t('enterMobile')}
                                    disabled={loading}
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label>{t('password')}</label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder={t('enterPassword')}
                                disabled={loading}
                            />
                        </div>

                        {!isLogin && (
                            <div className="form-group">
                                <label>{t('confirmPassword')}</label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder={t('confirmPasswordPlaceholder')}
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
                            {loading ? t('pleaseWait') : (isLogin ? t('signIn') : t('createAccount'))}
                        </button>
                    </form>

                    {/* Toggle Mode */}
                    <div className="toggle-mode">
                        <p>
                            {isLogin ? t('dontHaveAccount') : t('alreadyHaveAccount')}
                            {" "}
                            <span onClick={toggleMode} className="toggle-link">
                                {isLogin ? t('registerHere') : t('signInHere')}
                            </span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
