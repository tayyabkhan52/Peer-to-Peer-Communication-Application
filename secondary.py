# secondary.py
import os
import json
import time
import threading
import sys
import argparse
from datetime import datetime
from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room
import subprocess

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

registered_users = {}
chat_history = {}
online_users = {}
groups = {}

FAILURE_DETECTION_INTERVAL = 10
last_heartbeat_time = time.time()
primary_active = True
failover_triggered = False

def load_users():
    if os.path.exists('login.txt'):
        with open('login.txt', 'r') as f:
            for line in f:
                if ',' in line:
                    username, password = line.strip().split(',', 1)
                    registered_users[username] = password

def save_users():
    with open('login.txt', 'w') as f:
        for username, password in registered_users.items():
            f.write(f"{username},{password}\n")

def load_chat_history():
    if os.path.exists('chat_history'):
        for filename in os.listdir('chat_history'):
            filepath = os.path.join('chat_history', filename)
            with open(filepath, 'r') as f:
                if filename.startswith('group_'):
                    group_id = filename.replace('group_', '').replace('_chat.json', '')
                    groups[group_id] = json.load(f)
                else:
                    chat_history[filename] = json.load(f)

def save_chat_history(filename, data):
    if not os.path.exists('chat_history'):
        os.makedirs('chat_history')
    filepath = os.path.join('chat_history', filename)
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/heartbeat', methods=['POST'])
def heartbeat():
    global last_heartbeat_time
    last_heartbeat_time = time.time()
    print("Secondary: Heartbeat received from primary.")
    sys.stdout.flush()
    return "OK", 200

@socketio.on('register')
def handle_register(data):
    username = data['username']
    password = data['password']
    if username in registered_users:
        emit('response', {'type': 'error', 'message': 'Username already exists.'})
    else:
        registered_users[username] = password
        save_users()
        emit('response', {'type': 'success', 'message': 'Registration successful.'})

@socketio.on('login')
def handle_login(data):
    username = data['username']
    password = data['password']
    if registered_users.get(username) == password:
        online_users[request.sid] = username
        emit('response', {'type': 'success', 'message': 'Login successful.'})
        emit('update_user_list', get_user_list(), broadcast=True)
        user_chat_history = load_chat_history_for_user(username)
        emit('load_chat_history', user_chat_history)
        user_groups = load_group_histories_for_user(username)
        emit('load_groups', user_groups)
    else:
        emit('response', {'type': 'error', 'message': 'Invalid username or password.'})

def get_user_list():
    user_list = [{'username': uname, 'status': 'online' if uname in online_users.values() else 'offline'}
                for uname in registered_users]
    return user_list

def load_chat_history_for_user(username):
    user_chat_history = {}
    for filename, messages in chat_history.items():
        participants = filename.replace('_chat.json', '').split('_')
        if username in participants:
            other_user = participants[1] if participants[0] == username else participants[0]
            user_chat_history[other_user] = messages
    return user_chat_history

def load_group_histories_for_user(username):
    user_groups = {}
    for group_id, group_data in groups.items():
        if username in group_data['members']:
            user_groups[group_id] = group_data
    return user_groups

@socketio.on('create_group')
def handle_create_group(data):
    group_name = data['group_name']
    members = data['members']
    creator = online_users.get(request.sid)

    if not creator:
        emit('response', {'type': 'error', 'message': 'User not recognized.'})
        return

    group_id = str(len(groups) + 1)
    if creator not in members:
        members.append(creator)

    groups[group_id] = {
        'name': group_name,
        'members': members,
        'history': []
    }
    save_chat_history(f"group_{group_id}_chat.json", groups[group_id])

    emit('group_created', {'group_id': group_id, 'group_name': group_name, 'history': []})
    for member in members:
        if member != creator:
            member_sid = get_sid_by_username(member)
            if member_sid:
                emit('new_group', {'group_id': group_id, 'group_name': group_name, 'history': []}, room=member_sid)

@socketio.on('send_message')
def handle_send_message(data):
    sender = online_users.get(request.sid)
    recipient = data['recipient']
    message = data['content']
    timestamp = datetime.now().strftime('%A, %I:%M %p')

    if not sender:
        emit('response', {'type': 'error', 'message': 'Sender not recognized.'})
        return

    participants = sorted([sender, recipient])
    chat_filename = f"{participants[0]}_{participants[1]}_chat.json"
    if chat_filename not in chat_history:
        chat_history[chat_filename] = []
    chat_entry = {'timestamp': timestamp, 'sender': sender, 'content': message}
    chat_history[chat_filename].append(chat_entry)
    save_chat_history(chat_filename, chat_history[chat_filename])

    recipient_sid = get_sid_by_username(recipient)
    emit('receive_message', {
        'sender': sender,
        'recipient': recipient,
        'content': message,
        'timestamp': timestamp
    }, room=request.sid)
    if recipient_sid:
        emit('receive_message', {
            'sender': sender,
            'recipient': recipient,
            'content': message,
            'timestamp': timestamp
        }, room=recipient_sid)

@socketio.on('send_group_message')
def handle_group_message(data):
    sender = online_users.get(request.sid)
    group_id = data['group_id']
    message = data['content']
    timestamp = datetime.now().strftime('%A, %I:%M %p')

    if not sender:
        emit('response', {'type': 'error', 'message': 'Sender not recognized.'})
        return

    if group_id in groups and sender in groups[group_id]['members']:
        chat_entry = {'timestamp': timestamp, 'sender': sender, 'content': message}
        groups[group_id]['history'].append(chat_entry)
        save_chat_history(f"group_{group_id}_chat.json", groups[group_id])

        for member in groups[group_id]['members']:
            member_sid = get_sid_by_username(member)
            if member_sid:
                emit('receive_group_message', {
                    'group_id': group_id,
                    'group_name': groups[group_id]['name'],
                    'sender': sender,
                    'content': message,
                    'timestamp': timestamp
                }, room=member_sid)

@socketio.on('leave_group')
def handle_leave_group(data):
    username = online_users.get(request.sid)
    group_id = data['group_id']

    if not username:
        emit('response', {'type': 'error', 'message': 'User not recognized.'})
        return

    if group_id in groups and username in groups[group_id]['members']:
        groups[group_id]['members'].remove(username)
        save_chat_history(f"group_{group_id}_chat.json", groups[group_id])
        emit('left_group', {'group_id': group_id})
        for member in groups[group_id]['members']:
            member_sid = get_sid_by_username(member)
            if member_sid:
                emit('user_left_group', {'group_id': group_id, 'username': username}, room=member_sid)
    else:
        emit('response', {'type': 'error', 'message': 'Group not found or you are not a member.'})

@socketio.on('disconnect')
def handle_disconnect():
    username = online_users.pop(request.sid, None)
    if username:
        emit('update_user_list', get_user_list(), broadcast=True)

@socketio.on('send_file')
def handle_send_file(data):
    sender = online_users.get(request.sid)
    recipient = data['recipient']
    file_name = data['fileName']
    file_data = data['fileData']
    timestamp = datetime.now().strftime('%A, %I:%M %p')

    if not sender:
        emit('response', {'type': 'error', 'message': 'Sender not recognized.'})
        return

    participants = sorted([sender, recipient])
    chat_filename = f"{participants[0]}_{participants[1]}_chat.json"
    if chat_filename not in chat_history:
        chat_history[chat_filename] = []
    chat_history[chat_filename].append({
        'timestamp': timestamp,
        'sender': sender,
        'file_name': file_name,
        'file_data': file_data
    })
    save_chat_history(chat_filename, chat_history[chat_filename])

    emit('receive_file', {
        'sender': sender,
        'fileName': file_name,
        'fileData': file_data,
        'timestamp': timestamp
    }, room=request.sid)

    recipient_sid = get_sid_by_username(recipient)
    if recipient_sid:
        emit('receive_file', {
            'sender': sender,
            'fileName': file_name,
            'fileData': file_data,
            'timestamp': timestamp
        }, room=recipient_sid)

@socketio.on('send_group_file')
def handle_group_file(data):
    sender = online_users.get(request.sid)
    group_id = data['group_id']
    file_name = data['fileName']
    file_data = data['fileData']
    timestamp = datetime.now().strftime('%A, %I:%M %p')

    if not sender:
        emit('response', {'type': 'error', 'message': 'Sender not recognized.'})
        return

    if group_id in groups and sender in groups[group_id]['members']:
        groups[group_id]['history'].append({
            'timestamp': timestamp,
            'sender': sender,
            'file_name': file_name,
            'file_data': file_data
        })
        save_chat_history(f"group_{group_id}_chat.json", groups[group_id])

        for member in groups[group_id]['members']:
            member_sid = get_sid_by_username(member)
            if member_sid:
                emit('receive_file', {
                    'sender': sender,
                    'fileName': file_name,
                    'fileData': file_data,
                    'timestamp': timestamp
                }, room=member_sid)
    else:
        emit('response', {'type': 'error', 'message': 'You are not a member of this group or the group does not exist.'})

def get_sid_by_username(username):
    for sid, user in online_users.items():
        if user == username:
            return sid
    return None

def monitor_primary():
    global primary_active, failover_triggered
    while True:
        # Check how long since last heartbeat
        elapsed = time.time() - last_heartbeat_time
        if primary_active and elapsed > FAILURE_DETECTION_INTERVAL:
            primary_active = False
            trigger_failover()
        time.sleep(5)

def trigger_failover():
    global failover_triggered
    if not failover_triggered:
        failover_triggered = True
        print("Secondary: Primary server is down. Initiating failover...")
        print("Secondary would now take over on port 5000.")
        sys.stdout.flush()
        # Start the server on port 5000
        # Ensure that this script can be started with a different port
        subprocess.Popen([sys.executable, os.path.abspath(__file__), '--port', '5000'])
        # Exit the current server on port 5001
        os._exit(0)

def run_monitor(port):
    if port == 5001:
        monitor_thread = threading.Thread(target=monitor_primary, daemon=True)
        monitor_thread.start()

if __name__ == '__main__':
    # Parse command-line arguments to get the port
    parser = argparse.ArgumentParser(description='Secondary Server')
    parser.add_argument('--port', type=int, default=5001, help='Port to run the server on')
    args = parser.parse_args()

    port = args.port

    load_users()
    load_chat_history()

    run_monitor(port)

    # Run the server on the specified port
    socketio.run(app, port=port, debug=False)
