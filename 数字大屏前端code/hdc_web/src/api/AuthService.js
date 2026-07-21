import { Service, ServiceGet } from './Service.js'

export const login = form => Service.post('/api/auth/login', form)
export const register = form => Service.post('/api/auth/register', form)
export const getCurrentUser = () => ServiceGet.get('/api/auth/me')
export const logout = () => Service.post('/api/auth/logout')
export const getUsers = () => ServiceGet.get('/api/auth/users')
export const updateUser = (id, form) => Service.patch(`/api/auth/users/${id}`, form)
