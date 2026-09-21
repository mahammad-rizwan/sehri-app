import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../constants/api';
import * as SecureStore from 'expo-secure-store';

let socket: Socket | null = null;

export async function connectSocket() {
  if (socket?.connected) return socket;

  const token = await SecureStore.getItemAsync('accessToken');
  if (!token) return null;

  const baseUrl = API_BASE_URL.replace('/api', '');

  socket = io(baseUrl, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('Socket connected');
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.log('Socket connection error:', err.message);
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function listenNewMessage(callback: (msg: any) => void) {
  socket?.on('new-message', callback);
  return () => socket?.off('new-message', callback);
}

export function listenDeleteMessage(callback: (data: { msgId: string; groupId: string; createdAt: string }) => void) {
  socket?.on('delete-message', callback);
  return () => socket?.off('delete-message', callback);
}
