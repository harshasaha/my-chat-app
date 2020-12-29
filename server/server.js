const path = require('path');
const http = require('http');
const express = require('express');
const socketIO = require('socket.io');
var mysql = require('mysql')

const { generateMessage, generateLocationMessage } = require('./utils/message');
const { isRealString } = require('./utils/validation');
const { Users } = require('./utils/users');

const port = process.env.PORT || 3000;
const publicPath = path.join(__dirname, '../public');
var app = express();
var server = http.createServer(app);
var io = socketIO(server);
var users = new Users();

var db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  database: 'myChat'
})

db.connect(function (err) {
  if (err) {
    console.log(err)
  } else {
    console.log('Connected to DB');
  }
})

app.use(express.static(publicPath));

io.on('connection', (socket) => {

  socket.on('join', (params, callback) => {
    if (!isRealString(params.name) || !isRealString(params.room)) {
      return callback('User name and Room Name are required');
    }
    socket.join(params.room);
    users.removeUser(socket.id);
    users.addUser(socket.id, params.name, params.room);
    io.to(params.room).emit('updateUserList', users.getUserList(params.room));
    callback();
  });

  socket.on('createMessage', (message, callback) => {
    var user = users.getUser(socket.id);
    if (user && isRealString(message.text)) {
      db.query('INSERT INTO chat (text,user,chat_room) VALUES (?, ?, ?)', [message.text, user.name, user.room], function (error, results, fields) {
        if (error) {
          console.log("error ocurred", error);
        } else {
          console.log('results: ', results);
        }
      });
      io.to(user.room).emit('newMessage', generateMessage(user.name, message.text));
    }
    callback();
  });

  socket.on('disconnect', () => {
    var user = users.removeUser(socket.id);
    if (user) {
      io.to(user.room).emit('updateUserList', users.getUserList(user.room));
    }
    console.log('User was disconnected');
  });
});

server.listen(port, () => {
  console.log(`Started on port ${port}`);
});
