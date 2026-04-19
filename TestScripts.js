function testAllFunFacts(gameState) {
  //testFunFactData()
  gameState = gameState ?? loadPreviousGameState()
  funFactArray = postFunFact(gameState, true)

  for (let f of funFactArray) {
    Logger.log(f)
  }
}


function testNextFunFact() {
  funFactArray = postFunFact(testFunFactData(), false)
}


function testPostBluesky(gameState) {
  //postText = `Add our Colorado Rockies feed on Bluesky to ${getSynonym('followRockiesFeed')}: https://bsky.app/profile/did:plc:dkanfr5ivoi3hat7pz6fjiat/feed/coloradorox`

  gameState = gameState ?? loadPreviousGameState()
  postText = allTeamsRunDifferential(1)

  Logger.log(postText.length)

  blueskyLink = postBluesky(postText);
}

function testUploadVideoRecommended() {
  const url = 'https://bdata-producedclips.mlb.com/bc6ba1be-9797-4bdd-870e-278a702b15f1.mp4';
  Logger.log('Downloading video from: ' + url);
  
  const response = UrlFetchApp.fetch(url);
  const videoBytes = response.getBlob().getBytes();
  
  Logger.log('Uploading video to Bluesky...');
  const result = uploadVideoRecommended(videoBytes, 'video/mp4');
  
  Logger.log('Upload complete. Result: ' + JSON.stringify(result));
}