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