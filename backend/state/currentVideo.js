let currentVideoId = null;

function setCurrentVideoId(videoId) {
    currentVideoId = videoId;
}

function getCurrentVideoId() {
    return currentVideoId;
}

function clearCurrentVideoId() {
    currentVideoId = null;
}

module.exports = {
    setCurrentVideoId,
    getCurrentVideoId,
    clearCurrentVideoId
};