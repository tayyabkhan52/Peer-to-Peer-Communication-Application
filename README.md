# Peer-to-Peer-Communication-Application


## Overview
This project implements a hybrid Peer-to-Peer (P2P) Communication Application. Designed for scalability, usability, and security, it offers features such as real-time group chat, file sharing, and decentralized communication. Built using Python, Flask, and Socket.IO, this application enables secure and efficient interactions without relying on a central server for most operations.

---

## Features
- **Real-time Group Chat**: Communicate with multiple users in dynamically created chat rooms.
- **File Sharing**: Share files securely with other users or within groups.
- **Secure Login and Registration**: User authentication with persistent storage.
- **Group Management**: Create, manage, and leave groups easily.
- **Offline File Handling**: Deliver files to recipients even when they are offline.
- **Scalability and Reliability**: Includes load balancing and failover mechanisms.

---

## Prerequisites

To run this project, ensure you have the following installed:
- **Python 3.8+**
- **Flask**
- **Flask-SocketIO**
- **Requests**
- **Node.js**

Use the following command to install the required Python libraries:
```bash
pip install flask flask-socketio requests
```

---

## Project Structure
```
├── app.py               # Main server script
├── static/              # Contains static assets (CSS, JS, etc.)
├── templates/           # HTML templates
├── chat_history/        # Directory to store chat history (auto-created)
├── login.txt            # Stores registered users (auto-created)
```

---

## Running the Application

Follow these steps to set up and run the project:

1. **Clone the repository**
   ```bash
   git clone <repository_url>
   cd <repository_folder>
   ```

2. **Start the Server**
   Run the following command to start the Flask application:
   ```bash
   python app.py
   ```

   The server will start on `http://localhost:5000` by default.

3. **Access the Application**
   Open your web browser and go to:
   ```
   http://localhost:5000
   ```

4. **User Workflow**
   - Register a new account.
   - Login using the registered credentials.
   - Explore features such as group creation, chat, and file sharing.

---

## Development Notes
- **Persistent Data**: User data and chat histories are stored in `login.txt` and `chat_history/` respectively.
- **Failover Mechanism**: The primary server sends heartbeats to a secondary server for reliability.
- **Debugging**: The server runs in debug mode by default. Disable this in production for security.

---

## Contribution
Feel free to fork the repository and submit pull requests for improvements. Suggestions and feedback are welcome!

---

## License
This project is licensed under the MIT License. See the LICENSE file for more details.
