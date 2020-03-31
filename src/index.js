const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const Filter = require('bad-words')
const { generateMessage, generateLocationMessage } = require('./utils/messages')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')

const app = express()
const server = http.createServer(app)
const io = socketio(server)

const port = process.env.PORT || 3000
const publicDirectoryPath = path.join(__dirname,'../public')
// Tell express where static files are
app.use(express.static(publicDirectoryPath))
// runs for each new connection
io.on('connection', (socket) => {
    console.log('New Websocket connection')

    socket.on('join', ({ username, room }, callback) => {
        const {error, user } = addUser({ id: socket.id, username, room })
        
        // used trimmed version of username and room returned by addUser in code below

        if (error) {
           return callback(error)
        }
        
        socket.join(user.room)

        socket.emit('message', generateMessage('admin','Welcome!'))
        socket.broadcast.to(user.room).emit('message', generateMessage('admin', `${user.username} has joined!`))
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback()
        
        // socket.emit (to specific user), io.emit (to everyone connected), socket.broadcast.emit (everyone but this client) 
        // io.to.emit (to everyone in a specific room), socket.broadcast.to.emit (everyone in room but this client)
    })

    socket.on('sendMessage', (message, callback) => {
        // server receives message from a client and emits it to all other clients
        const user = getUser(socket.id)
        const filter = new Filter()

        if (filter.isProfane(message)){
            return callback('Profanity is not allowed.  Message was rejected.')
        }
 
        io.to(user.room).emit('message', generateMessage(user.username, message))
        callback()
    })

    socket.on('sendLocation', (coords, callback) => {
        const user = getUser(socket.id)
        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${coords.latitude},${coords.longitude}`))
        callback()
    })

    // disconnect is a built in event - no code needed in the CSJS
    socket.on('disconnect', () => {
        const user = removeUser(socket.id)

        if (user) {
            io.to(user.room).emit('message',generateMessage('admin',`${user.username} has left`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })

})

server.listen(port, () => {
    console.log(`Chat server is running on port ${port}`)
})

