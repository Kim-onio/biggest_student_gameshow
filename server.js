const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const xlsx = require('xlsx');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 3000;

app.use(express.static('public'));
app.use('/admin', express.static('admin'));
app.use('/player1', express.static('player1'));
app.use('/player2', express.static('player2'));
app.use('/player3', express.static('player3'));

// Excel Parsing
const workbook = xlsx.readFile('questions.xlsx');
const questionsSheet = workbook.Sheets[workbook.SheetNames[0]];
const questions = xlsx.utils.sheet_to_json(questionsSheet);

// Game state
let round = 1;
let mode = null;
let scores = [0, 0, 0];
let currentQuestionIndex = 0;
let responses = ["", "", ""];
let responseTimes = ["", "", ""];

function getRandomMode() {
  const modes = ['Mode A', 'Mode B', 'Mode C'];
  return modes[Math.floor(Math.random() * modes.length)];
}

function getQuestionsForRound(roundNum) {
  return questions.filter(q => q.Round == roundNum);
}

function broadcastScores() {
  io.emit('updateScores', scores);
}

function broadcastRoundInfo() {
  io.emit('updateRoundInfo', { round, mode });
}

function broadcastResponses() {
  io.emit('updateResponses', { responses, times: responseTimes });
}

function broadcastControls(canStartTimer, canNextQuestion) {
  io.emit('adminControls', { canStartTimer, canNextQuestion });
}

function resetResponses() {
  responses = ["", "", ""];
  responseTimes = ["", "", ""];
}

io.on('connection', (socket) => {
  console.log('Client connected');

  socket.emit('updateScores', scores);
  socket.emit('updateRoundInfo', { round, mode });
  socket.emit('updateResponses', { responses, times: responseTimes });

  socket.on('adminStartRound', () => {
    mode = (round === 2 || round === 4) ? getRandomMode() : null;
    currentQuestionIndex = 0;
    resetResponses();
    broadcastRoundInfo();
    broadcastControls(true, false);
  });

  socket.on('adminStartTimer', () => {
    const roundQuestions = getQuestionsForRound(round);
    const currentQuestion = roundQuestions[currentQuestionIndex];
    io.emit('startQuestion', currentQuestion);
    broadcastControls(false, false);
  });

  socket.on('adminNextQuestion', () => {
    currentQuestionIndex++;
    resetResponses();
    const roundQuestions = getQuestionsForRound(round);
    if (currentQuestionIndex < roundQuestions.length) {
      broadcastControls(true, false);
    } else {
      // End of round
      round++;
      mode = null;
      broadcastRoundInfo();
      broadcastControls(false, false);
    }
  });

  socket.on('playerAnswer', ({ playerIndex, answer, time }) => {
    responses[playerIndex] = answer;
    responseTimes[playerIndex] = time + "s";
    broadcastResponses();
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
