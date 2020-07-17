
// 1. Set up the Streaming Speech Recognition API
var final_transcript = 'The following is a conversation with an AI assistant. The assistant is helpful, creative, clever, and very friendly. \n\
\n\
Human: Hello, who are you?\n\
AI: I am an AI created by OpenAI. How can I help you today?\n\
Human: ';

var completionWord = "complete";

var temporary_status = 'Listening...';
document.body.innerHTML = temporary_status;
var recognizing = false;
var ignore_onend;
var start_timestamp;

var recognition = new webkitSpeechRecognition();
recognition.continuous = true;
recognition.interimResults = true;
recognition.onstart = function() {
  recognizing = true;
  temporary_status = "\n\nListening...  Say '"+completionWord+"' to Submit to the AI.";
  updateStatus();
};
recognition.onerror = function(event) {
  if (event.error == 'no-speech') {
    temporary_status = "\n\nDidn't detect any speech...";
    updateStatus();
    ignore_onend = true;
  }
  if (event.error == 'audio-capture') {
    temporary_status = "\n\nDidn't detect any microphone...";
    updateStatus();
    ignore_onend = true;
  }
  if (event.error == 'not-allowed') {
    temporary_status = "\n\nSpeech recognition blocked...";
    updateStatus();
    ignore_onend = true;
  }
};
recognition.onresult = function(event) {
  var interim_transcript = '';
  if (typeof(event.results) == 'undefined') {
    recognition.onend = null;
    recognition.stop();
    temporary_status = "\n\nBrowser doesn't support speech recognition...";
    return;
  }
  for (var i = event.resultIndex; i < event.results.length; ++i) {
    if (event.results[i].isFinal) {
      final_transcript   += event.results[i][0].transcript;
    } else {
      interim_transcript += event.results[i][0].transcript;
    }
  }
  final_transcript         = capitalize(final_transcript);
  document.body.innerHTML  = linebreak (final_transcript);
  document.body.innerHTML += linebreak (interim_transcript);
  document.body.innerHTML += linebreak (temporary_status);
  
  if (final_transcript.toLowerCase().includes(completionWord)) {
    final_transcript = final_transcript.replace(new RegExp("\w* "+completionWord, "gi"), ".");
    recognition.stop();
  }
};
recognition.onend = function() {
  recognizing = false;
  if (ignore_onend) {
    if (temporary_status === "\n\nDidn't detect any speech...") {
      startButton();
  } return; }
  final_transcript += "\nAI:"; // <- NO SPACE AFTER THE COLON GRAAAAAGH
  temporary_status = "\n\nWaiting for AI...";
  updateStatus();
  queryAPI();
};

function startButton() {
  if (recognizing) {
    recognition.stop();
    return;
  }
  recognition.start();
  ignore_onend = false;
}
startButton();

// 2. Submit to GPT-3 and receive a streaming response...
if (!new URLSearchParams(window.location.search).has("key")) {
  window.history.replaceState({}, 'OpenAI Voice', "?key=sk-YOURSECRETKEYHERE");
}
function queryAPI() {
  if (new URLSearchParams(window.location.search).get("key") === "sk-YOURSECRETKEYHERE") {
    temporary_status = "\n\n--~*Put your Open AI API Key into the URL bar and refresh!*~--\n\nExiting...";
    updateStatus();
    return;
  }

  let AIRequest = new SSE("https://api.openai.com/v1/engines/davinci/completions", {
    headers: {
      'Content-Type': 'application/json',
      "Authorization": "Bearer "+ new URLSearchParams(window.location.search).get("key")
    },
    payload: JSON.stringify({
      "prompt": final_transcript,
      "max_tokens": 300,
      "temperature": 0.9,
      "top_p": 1,
      "n": 1,
      "stream": true,
      "logprobs": null,
      "stop": "\n",
    })
  });
  let messageHandler = function (e) {
    console.log(e.data);

    // If finished speaking, transfer to listening again.
    if (e.data === "[DONE]"){// || !e.data || !JSON.parse(e.data).choices[0].text) {
      AIRequest.close();
      AIRequest.removeEventListener("message", messageHandler);
      speak('', true);
      final_transcript += "\nHuman: ";
      updateStatus();
      startIfDoneTalking();
      return;
    }

    // Otherwise speak what we're receiving.
    speak(JSON.parse(e.data).choices[0].text);
  }.bind(this);
  AIRequest.addEventListener('message', messageHandler);
  AIRequest.stream();
}

var startIfDoneTalking = function () {
  setTimeout(() => {
    if (!window.speechSynthesis.speaking && !recognizing) {
      startButton();
    } else {
      startIfDoneTalking();
    }
  }, 1500);
}

// 3. Set up feeding the Streaming GPT-3 Info into the Text to Speech engine
alert("Ensure that your OpenAI API Key has been added to the URL.\nThis dialog also enables voice synthesis.");

var synthesizedVoices = window.speechSynthesis.getVoices();
window.speechSynthesis.onvoiceschanged = (event) => {
  synthesizedVoices = window.speechSynthesis.getVoices();
}
function speakVoice(speech) {
  let speechUtterance = new SpeechSynthesisUtterance(speech);

  for (let i = 0; i < synthesizedVoices.length; i++){
    //console.log(synthesizedVoices[i]);
    if (synthesizedVoices[i].voiceURI === "Google UK English Female") { //Google US English, Google UK English Female, Google UK English Male
      speechUtterance.voice = synthesizedVoices[i];
    }
  }

  window.speechSynthesis.speak(speechUtterance);
}

var streamingResponse = '';
function speak(input = '', forceSpeak = false) {

  final_transcript  += input;
  if (input.includes(".")) {
    let curStrs = input.split(".");
    streamingResponse += curStrs[0] + ".";
    speakVoice(streamingResponse);
    streamingResponse = curStrs[1];
  }else if (input.includes("?")) {
    let curStrs = input.split("?");
    streamingResponse += curStrs[0] + "?";
    speakVoice(streamingResponse);
    streamingResponse = curStrs[1];
  }else if (input.includes("!")) {
    let curStrs = input.split("!");
    streamingResponse += curStrs[0] + "!";
    speakVoice(streamingResponse);
    streamingResponse = curStrs[1];
  } else {
    streamingResponse += input;
  }

  updateStatus();
}

// Utility Functions
var two_line   = /\n\n/g;
var one_line   = /\n/g;
var first_char = /\S/;
function linebreak(s) {
  return s.replace(two_line, '<p></p>').replace(one_line, '<br>');
}
function capitalize(s) {
  return s.replace(first_char, function(m) { return m.toUpperCase(); });
}

function updateStatus() {
  document.body.innerHTML  = linebreak (final_transcript);
  document.body.innerHTML += linebreak (temporary_status);
}
