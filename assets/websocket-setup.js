function setupWebsocket(server) {
  const socket = new WebSocket(server)

  socket.onerror = (error) => {
    console.error('Error on socket: ' + JSON.stringify(error));
  }

  socket.onopen = (event) => {
    socket.onmessage = (event) => {
      const data = event.data;
      const vars = JSON.parse(data);

      for (k in vars) {
        __AllVars[k] = vars[k];
      }
    }
  }
}
