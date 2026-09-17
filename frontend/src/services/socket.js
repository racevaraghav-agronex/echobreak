import { io } from "socket.io-client";

const rawSocketUrl = import.meta.env.VITE_SOCKET_URL;
const SOCKET_URL =
  (rawSocketUrl && !rawSocketUrl.includes(":5000") && !rawSocketUrl.includes("localhost")
    ? rawSocketUrl
    : "") || (typeof window !== "undefined" ? window.location.origin : "");

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ["polling", "websocket"],
      auth: { token: localStorage.getItem("echobreak_token") || undefined },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket && socket.connected) socket.disconnect();
}
