function mediaRecorder() {

    var btnStartRecording = document.querySelector('#btn-start-recording');
    var btnStopRecording  = document.querySelector('#btn-stop-recording');
    var btnSaveRecording  = document.querySelector('#btn-save');

    var videoElement      = document.querySelector('video');

    var progressBar = document.querySelector('#progress-bar');
    var percentage = document.querySelector('#percentage');

    // global variables
    var currentBrowser = !!navigator.mozGetUserMedia ? 'gecko' : 'chromium';

    var fileName;
    var audioRecorder;
    var videoRecorder;

    var btnSaveRecording  = document.querySelector('#btn-save');


    // Firefox can record both audio/video in single webm container
    // Don't need to create multiple instances of the RecordRTC for Firefox
    // You can even use below property to force recording only audio blob on chrome
    // var isRecordOnlyAudio = true;
    var isRecordOnlyAudio = !!navigator.mozGetUserMedia;

    // if recording only audio, we should replace "HTMLVideoElement" with "HTMLAudioElement"
    if(isRecordOnlyAudio && currentBrowser == 'chromium') {
        var parentNode = videoElement.parentNode;
        parentNode.removeChild(videoElement);
        
        videoElement = document.createElement('audio');
        videoElement.style.padding = '.4em';
        videoElement.controls = true;
        parentNode.appendChild(videoElement);
    }

    // reusable helpers

    // this function submits both audio/video or single recorded blob to nodejs server
    function postFiles(audio, video) {
        // getting unique identifier for the file name
        fileName = generateRandomString();

        // this object is used to allow submitting multiple recorded blobs
        var files = { };

        // recorded audio blob
        files.audio = {
            name: fileName + '.' + audio.blob.type.split('/')[1],
            type: audio.blob.type,
            contents: audio.dataURL
        };

        if(video) {
            files.video = {
                name: fileName + '.' + video.blob.type.split('/')[1],
                type: video.blob.type,
                contents: video.dataURL
            };
        }

        files.uploadOnlyAudio = !video;

        videoElement.src = '';
        videoElement.poster = '/ajax-loader.gif';

        // replay the video plus add controls
        xhr('/videos', JSON.stringify(files), function(_fileName) {

            videoElement.src = _fileName;
            // videoElement.play();
            videoElement.muted = false;
            videoElement.controls = true;

            btnSaveRecording.disabled = false;

            var h2 = document.createElement('h2');
            h2.innerHTML = '<a href="' + videoElement.src + '">' + videoElement.src + '</a>';
            // document.body.appendChild(h2);
        });

        if(mediaStream) mediaStream.stop();
    }

    // XHR2/FormData
    function xhr(url, data, callback) {
        var request = new XMLHttpRequest();
        request.onreadystatechange = function() {
            if (request.readyState == 4 && request.status == 200) {
                callback(request.responseText);
            }
        };

        request.upload.onprogress = function(event) {
            progressBar.max = event.total;
            progressBar.value = event.loaded;
            progressBar.innerHTML = 'Upload Progress ' + Math.round(event.loaded / event.total * 100) + "%";
        };

        request.upload.onload = function() {
            percentage.style.display = 'none';
            progressBar.style.display = 'none';
        };
        request.open('POST', url);
        request.send(data);

    }

    // generating random string
    function generateRandomString() {
        if (window.crypto) {
            var a = window.crypto.getRandomValues(new Uint32Array(3)),
                token = '';
            for (var i = 0, l = a.length; i < l; i++) token += a[i].toString(36);
            return token;
        } else {
            return (Math.random() * new Date().getTime()).toString(36).replace( /\./g , '');
        }
    }

    // when btnStopRecording is clicked
    function onStopRecording() {
        // audioUrl = audioRecorder.getDataURL()
        // processData(audioUrl)

        audioRecorder.getDataURL(function(audioDataURL) {
            var audio = {
                blob: audioRecorder.getBlob(),
                dataURL: audioDataURL
            };
            
            // if record both wav and webm
            if(!isRecordOnlyAudio) {
                videoRecorder.getDataURL(function(videoDataURL) {
                    var video = {
                        blob: videoRecorder.getBlob(),
                        dataURL: videoDataURL
                    };
                    
                    postFiles(audio, video);
                });
            }
            
            // if record only audio (either wav or ogg)
            if (isRecordOnlyAudio) postFiles(audio);
        });
    }

    var mediaStream = null;
    // reusable getUserMedia
    function captureUserMedia(success_callback) {
        var session = {
            audio: true,
            video: true
        };
        
        navigator.getUserMedia(session, success_callback, function(error) {
            alert( JSON.stringify(error) );
        });
    }

    // UI events handling
    btnStartRecording.onclick = function() {
        btnStartRecording.disabled = true;
        
        captureUserMedia(function(stream) {
            mediaStream = stream;
            
            videoElement.src = window.URL.createObjectURL(stream);
            videoElement.play();
            videoElement.muted = true;
            videoElement.controls = false;

            // it is second parameter of the RecordRTC
            var audioConfig = {};
            if(!isRecordOnlyAudio) {
                audioConfig.onAudioProcessStarted = function() {
                    // invoke video recorder in this callback
                    // to get maximum sync
                    videoRecorder.startRecording();
                };
            }

            audioRecorder = RecordRTC(stream, audioConfig);
            
            if(!isRecordOnlyAudio) {
                // it is second parameter of the RecordRTC
                var videoConfig = { type: 'video', video: {width: 480, height: 360}, canvas: {width: 480, height: 360}};
                // var videoConfig = { type: 'video' };
                videoRecorder = RecordRTC(stream, videoConfig);
            }
            
            audioRecorder.startRecording();
            
            // enable stop-recording button
            btnStopRecording.disabled = false;
        });
    };


    btnStopRecording.onclick = function() {
        btnStartRecording.disabled = false;
        btnStopRecording.disabled = true;
        
        if(isRecordOnlyAudio) {
            audioRecorder.stopRecording(onStopRecording);
        }

        if(!isRecordOnlyAudio) {
            audioRecorder.stopRecording(function() {
                videoRecorder.stopRecording(function() {
                    onStopRecording();
                });
            });
        }

    };


    window.onbeforeunload = function() {
        startRecording.disabled = false;
    };

};


function postVideo() {

    var videoElement = document.querySelector('video');

    var videoForm = document.querySelector('#form-post-video');
    var btnSaveRecording  = document.querySelector('#btn-save');
    var filenameField = document.querySelector('#filepath');

    btnSaveRecording.disabled = true;

    filenameField.setAttribute('value', videoElement.src);
    videoForm.submit();

};