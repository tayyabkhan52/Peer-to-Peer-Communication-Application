    // Initialize Socket.IO client
    const socket = io();

    // Variables to store current user and selected chat
    let currentUser = '';
    let selectedUser = '';
    let selectedGroup = '';

    // Object to store chat histories
    let chatHistories = {};  // { other_user: [messages] }
    let groupHistories = {}; // { group_id: [messages] }

    // Handle user registration
    document.getElementById('register-btn').addEventListener('click', function() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        if (username && password) {
            socket.emit('register', { username, password });
        } else {
            displayAuthMessage('Please enter both username and password.', 'error');
        }
    });

    // Handle user login
    document.getElementById('login-btn').addEventListener('click', function() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        if (username && password) {
            socket.emit('login', { username, password });
        } else {
            displayAuthMessage('Please enter both username and password.', 'error');
        }
    });

    // Function to display authentication messages
    function displayAuthMessage(message, type) {
        const authMessage = document.getElementById('auth-message');
        authMessage.textContent = message;
        authMessage.className = 'auth-message ' + (type === 'success' ? 'success' : 'error');
    }

    // Handle server response for registration and login
    socket.on('response', function(data) {
        displayAuthMessage(data.message, data.type);
        if (data.type === 'success' && data.message === 'Login successful.') {
            currentUser = document.getElementById('username').value.trim();
            document.getElementById('auth-container').style.display = 'none';
            document.getElementById('chat-container').style.display = 'flex';
            document.querySelector('#username-display strong').textContent = currentUser;
            document.getElementById('status-display').innerHTML = '<i class="fas fa-circle"></i> Online';
            document.getElementById('status-display').className = 'status online';
        }
    });

    // Update user list when received from server
    socket.on('update_user_list', function(users) {
        const userList = document.getElementById('user-list');
        userList.innerHTML = ''; // Clear existing list
        users.forEach(user => {
            if (user.username !== currentUser) {
                const userItem = document.createElement('li');
                userItem.className = user.status === 'online' ? 'online' : 'offline';
                userItem.innerHTML = `<i class="fas fa-user"></i><span class="user-name">${user.username}</span>`;
                userItem.addEventListener('click', function() {
                    selectUser(user.username);
                });
                userList.appendChild(userItem);
            }
        });

        // Update group creation user list
        const groupUserList = document.getElementById('group-user-list');
        groupUserList.innerHTML = '';
        users.forEach(user => {
            if (user.username !== currentUser) {
                const userItem = document.createElement('li');
                userItem.className = 'offline';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = user.username;
                userItem.appendChild(checkbox);
                const usernameSpan = document.createElement('span');
                usernameSpan.innerText = user.username;
                userItem.appendChild(usernameSpan);
                groupUserList.appendChild(userItem);
            }
        });
    });

    // Handle group creation
    document.getElementById('create-group-btn').addEventListener('click', function() {
        document.getElementById('group-modal').style.display = 'block';
    });

    document.getElementById('create-group-cancel-btn').addEventListener('click', function() {
        document.getElementById('group-modal').style.display = 'none';
    });

    document.getElementById('create-group-confirm-btn').addEventListener('click', function() {
        const groupName = document.getElementById('group-name').value.trim();
        const checkboxes = document.querySelectorAll('#group-user-list input[type="checkbox"]:checked');
        const members = Array.from(checkboxes).map(cb => cb.value);
        if (groupName && members.length > 0) {
            socket.emit('create_group', { group_name: groupName, members: members });
            document.getElementById('group-modal').style.display = 'none';
            document.getElementById('group-name').value = '';
            checkboxes.forEach(cb => cb.checked = false);
        } else {
            alert('Please enter a group name and select at least one member.');
        }
    });

    // Handle group creation confirmation
    socket.on('group_created', function(data) {
        // Add the new group to the group list
        addGroupToList(data.group_id, data.group_name);
        // Initialize group history
        groupHistories[data.group_id] = data.history || [];
    });

    // Handle new group notification
    socket.on('new_group', function(data) {
        addGroupToList(data.group_id, data.group_name);
        // Initialize group history
        groupHistories[data.group_id] = data.history || [];
    });

    // Handle loading groups on login
    socket.on('load_groups', function(groups) {
        for (const group_id in groups) {
            const group = groups[group_id];
            addGroupToList(group_id, group.name);
            groupHistories[group_id] = group.history || [];
        }
    });

    // Function to add a group to the group list
    function addGroupToList(group_id, group_name) {
        const groupList = document.getElementById('group-list');
        const groupItem = document.createElement('li');
        groupItem.dataset.groupId = group_id;
        groupItem.innerHTML = `<i class="fas fa-users"></i><span class="group-name">${group_name}</span>`;
        groupItem.addEventListener('click', function() {
            selectGroup(group_id, group_name);
        });
        groupList.appendChild(groupItem);
    }

    // Function to select a group to chat with
    function selectGroup(group_id, group_name) {
        selectedGroup = group_id;
        selectedUser = '';
        document.getElementById('chat-with').innerText = 'Group: ' + group_name;
        document.getElementById('messages').innerHTML = ''; // Clear previous messages
        document.getElementById('leave-group-btn').style.display = 'inline-block';
        // Load group chat history
        if (groupHistories[group_id]) {
            groupHistories[group_id].forEach(message => {
                displayMessage(message, true);
            });
        }
    }

    // Handle leaving a group
    document.getElementById('leave-group-btn').addEventListener('click', function() {
        if (selectedGroup) {
            socket.emit('leave_group', { group_id: selectedGroup });
            // Remove the group from the group list
            const groupList = document.getElementById('group-list');
            const groupItems = groupList.getElementsByTagName('li');
            for (let i = 0; i < groupItems.length; i++) {
                if (groupItems[i].dataset.groupId === selectedGroup) {
                    groupList.removeChild(groupItems[i]);
                    break;
                }
            }
            // Clear the chat area
            selectedGroup = '';
            document.getElementById('chat-with').innerText = 'Select a user or group to start chatting';
            document.getElementById('messages').innerHTML = '';
            document.getElementById('leave-group-btn').style.display = 'none';
        }
    });

    // Handle group leave confirmation
    socket.on('left_group', function(data) {
        // Already handled in the leave group button click
    });

    // Handle receiving group messages
    socket.on('receive_group_message', function(data) {
        // Update group history
        if (!groupHistories[data.group_id]) {
            groupHistories[data.group_id] = [];
        }
        groupHistories[data.group_id].push(data);
        // If the message is relevant to the current chat, display it
        if (data.group_id === selectedGroup) {
            displayMessage(data, true);
        }
    });

    // Function to select a user to chat with
    function selectUser(username) {
        selectedUser = username;
        selectedGroup = '';
        document.getElementById('chat-with').innerText = 'Chat with ' + username;
        document.getElementById('messages').innerHTML = ''; // Clear previous messages
        document.getElementById('leave-group-btn').style.display = 'none';
        // Load chat history with the selected user
        if (chatHistories[selectedUser]) {
            chatHistories[selectedUser].forEach(message => {
                displayMessage(message);
            });
        }
    }

    // Load chat history when received from server
    socket.on('load_chat_history', function(data) {
        chatHistories = data; // Data format: { 'other_user': [messages] }
    });

    // Handle sending a message
    document.getElementById('send-btn').addEventListener('click', function() {
        sendMessage();
    });

    // Allow sending message by pressing 'Enter'
    document.getElementById('message-input').addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });

    // Function to send a message
    function sendMessage() {
        const messageInput = document.getElementById('message-input');
        const message = messageInput.value.trim();
        if (message) {
            if (selectedUser) {
                socket.emit('send_message', { recipient: selectedUser, content: message });
            } else if (selectedGroup) {
                socket.emit('send_group_message', { group_id: selectedGroup, content: message });
            }
            messageInput.value = ''; // Clear input after sending
        }
    }

    // Handle receiving a message
    socket.on('receive_message', function(data) {
        // Update chat history
        const otherUser = data.sender === currentUser ? data.recipient : data.sender;
        if (!chatHistories[otherUser]) {
            chatHistories[otherUser] = [];
        }
        chatHistories[otherUser].push(data);
        // If the message is relevant to the current chat, display it
        if (otherUser === selectedUser) {
            displayMessage(data);
        }
    });

    // Function to display a message in the chat
    function displayMessage(data, isGroup = false) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.classList.add(data.sender === currentUser ? 'self' : 'other');
        const senderName = data.sender === currentUser ? 'You' : data.sender;
        messageElement.innerHTML = `${isGroup && data.sender !== currentUser ? '<strong>' + senderName + '</strong><br>' : ''}${data.content}<span class="timestamp">${data.timestamp}</span>`;
        document.getElementById('messages').appendChild(messageElement);
        // Scroll to the bottom of the chat
        const chatDisplay = document.getElementById('chat-display');
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    }

    // Function to handle file selection
document.getElementById('send-file-btn').addEventListener('click', function() {
    const fileInput = document.getElementById('file-input');
    fileInput.click(); // Trigger file input click
});

// Handle file selection
document.getElementById('file-input').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        console.log(`Selected file: ${file.name}, Size: ${file.size} bytes`);
        sendFile(file);
    } else {
        console.log('No file selected.');
    }
});

function sendFile(file) {
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB limit
    if (file.size > MAX_FILE_SIZE) {
        console.error(`File size exceeds the limit of ${MAX_FILE_SIZE / (1024 * 1024)} MB.`);
        alert(`File size exceeds the limit of ${MAX_FILE_SIZE / (1024 * 1024)} MB.`);
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        console.log(`Sending file: ${file.name}`);
        if (selectedGroup) {
            // Emit the file data for group chat
            socket.emit('send_group_file', {
                group_id: selectedGroup,
                fileName: file.name,
                fileData: event.target.result // Base64 encoded file data
            });
        } else if (selectedUser) {
            // Emit the file data for individual chat
            socket.emit('send_file', {
                recipient: selectedUser,
                fileName: file.name,
                fileData: event.target.result // Base64 encoded file data
            });
        } else {
            console.error('No recipient or group selected.');
            alert('Please select a user or group to send the file.');
        }
    };

    reader.onerror = function() {
        console.error('Error reading file. Please try again.');
        alert('Error reading file. Please try again.');
    };

    reader.readAsDataURL(file); // Read file as data URL
}

// Handle receiving a file
socket.on('receive_file', function(data) {
    const { sender, fileName, fileData, timestamp } = data;
    console.log(`Received file: ${fileName} from ${sender}`);
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(sender === currentUser  ? 'self' : 'other');
    const senderName = sender === currentUser  ? 'You' : sender;
    messageElement.innerHTML = `<strong>${senderName}</strong><br>
                                <a href="${fileData}" download="${fileName}">${fileName}</a>
                                <span class="timestamp">${timestamp}</span>`;
    document.getElementById('messages').appendChild(messageElement);
    // Scroll to the bottom of the chat
    const chatDisplay = document.getElementById('chat-display');
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
});

    // Handle user logout
    document.getElementById('logout-btn').addEventListener('click', function() {
        // Reload the page to reset the application
        location.reload();
    });

    // Sidebar toggle functionality
    document.getElementById('sidebar-toggle').addEventListener('click', function() {
        document.querySelector('.sidebar').classList.toggle('collapsed');
    });

    // Profile toggle functionality
    document.getElementById('profile-toggle').addEventListener('click', function() {
        document.querySelector('.profile-section').classList.toggle('collapsed');
    });