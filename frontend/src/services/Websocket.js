class WebSocketService {
  constructor() {
    this.ws = null;
    this.listeners = new Set();
  }

  connect() {
    this.ws = new WebSocket('ws://localhost:3000');

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.notifyListeners(data);
    };

    this.ws.onclose = () => {
      setTimeout(() => this.connect(), 5000); // Reconnect after 5 seconds
    };
  }

  addListener(callback) {
    this.listeners.add(callback);
  }

  removeListener(callback) {
    this.listeners.delete(callback);
  }

  notifyListeners(data) {
    this.listeners.forEach(listener => listener(data));
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

export const wsService = new WebSocketService();
export default wsService;