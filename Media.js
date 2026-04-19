
function pullGameHighlights(gameState) {
  var _ = LodashGS.load();

  gameState = gameState ?? loadPreviousGameState()
  //getGameContent
  url = `https://statsapi.mlb.com/api/v1/game/${gameState.gamePk}/content` //+ hydrations
  Logger.log(url)
  
  
  let response = JSON.parse(UrlFetchApp.fetch(url))//.getContentText();
  content = response

  //Logger.log('content')
  //Logger.log(content)
  //content = getGameContent();


  highlights = content.highlights.highlights.items
  freeGame = content.media.freeGame

  //Logger.log(highlights)

  //for (item of highlights)
    //{Logger.log(`${item.date} ${item.headline}` )}
  
  highlights = _.sortBy(highlights, 'date')

  //Logger.log('array sorted')
  for (item of highlights) {
    eventDate = new Date(item.date)
    mp4Link = ''
    for (link of item.playbacks) {
      if (link.name == 'mp4Avc') {
       item.link = link.url
        break;
      }
    }

    //Logger.log(`${eventDate} ${item.duration} ${item.headline} ${mp4Link}` )
  }

  //Logger.log(new Date())

  return [highlights, freeGame]
}

// New helper function to encapsulate defensive play posting logic
function postDefensivePlayVideo(gameState) {
  var [hour, min, sec] = gameState.highlightDuration.split(":")
  var isShortVideo = (min == '00');

  let defensivePlayTerms = ['barehand', 'catch', 'caught stealing', 'clean inning', 'climbs the ladder', 'dart', 'defensive', 'deflected', 'diving', 'double play', 'escapes', 'fans', 'fanning', 'fly out', 'force out', 'foul ball', 'foul territory', 'foul tip', 'glove', 'gunned down', 'induces', 'jam', 'k', "k's", 'nabs', 'out at', 'pick', 'pick off', 'picks off', 'retires', 'retires the side', 'robbed', 'rockies fan', 'robs', 'save', 'scoreless', 'seals the win', 'sits down', 'snag', 'stop', 'strikeout', 'strikes out', 'striking out the side', 'throw', 'throws out', 'turns two'];
  let defensivePlay = false;
  let searchContent = (gameState.highlightHeadline + " " + (gameState.highlightDescription || "")).toLowerCase();
  
  for (let i = 0; i < defensivePlayTerms.length; i++) {
    if (searchContent.search(defensivePlayTerms[i].toLowerCase()) != -1) {
      defensivePlay = true;
      Logger.log('   - Defensive play term found: ' + defensivePlayTerms[i])
      break;
    }
  }

  if (isShortVideo && defensivePlay) {
    let tempMediaTeam = (gameState.inningState == 'Top' || gameState.inningState == 'Middle') ? gameState.homeTeam : gameState.awayTeam;
    if (tempMediaTeam === 'Colorado Rockies') {
      Logger.log("   - Rockies defensive video qualifies! Posting it immediately as standalone.");
      let tempMediaSynonym = 'wentOkSynonym';
      const videoText = (gameState.highlightDescription && gameState.highlightDescription.trim() !== '') 
        ? gameState.highlightDescription 
        : gameState.highlightHeadline;
      let defensiveMessage = `${getSynonym(tempMediaSynonym)}
${allTeamInfo()[tempMediaTeam].teamName} — ${videoText}:`;

      let [blueskyLink, uri, cid] = downloadAndPostVideo(gameState, false, defensiveMessage);
      recordPostToSheet(blueskyLink, gameState.highlightOutput); // Record the post
      return true; // Indicate that a defensive post was made
    } else {
      Logger.log("   - Defensive video qualifies, but was not by the Rockies. Skipping post.");
    }
  }
  return false; // No defensive post was made
}


function processGameHighlights(gameState) {
  gameState = gameState ?? loadPreviousGameState();
  [highlights, freeGame] = pullGameHighlights(gameState)
  gameState.highlightHeadline = highlights[highlights.length - 1].headline
  gameState.highlightDuration = highlights[highlights.length - 1].duration
  gameState.highlightLink = highlights[highlights.length - 1].link
  gameState.highlightDescription = highlights[highlights.length - 1].description || '';
  gameState.highlightOutput = `=HYPERLINK("${gameState.highlightLink}","${gameState.highlightHeadline}")`
  gameState.freeGame = freeGame;

  // Removed: const defensivePostMade = postDefensivePlayVideo(gameState);
  // The logic for processing highlights and queuing/posting is all in postGameVideo.

  //Logger.log(gameState.highlightDuration)
  //Logger.log(gameState.highlightHeadline + " " + previousGameState.highlightHeadline)

  //output all game media when length changes
  //if(gameState.gameMediaArrayLength != highlights.length) {
  outputHighlights = []

  for (let h of highlights) {
    var dateTime = new Date(h.date);
    var timezone = Session.getScriptTimeZone();
    dateTime = Utilities.formatDate(dateTime, timezone, "yyyy-MM-dd HH:mm:ss");
    outputHighlights.push([dateTime, h.duration, `=HYPERLINK("${h.link}","${h.headline}")`, h.description])
  }


  gameState.gameMediaArrayLength = highlights.length;
  //get date and time info
  var timezone = Session.getScriptTimeZone();
  var dateTime = new Date();
  dateTime = Utilities.formatDate(dateTime, timezone, "yyyy-MM-dd HH:mm:ss");
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Current Game Media");
  sheet.getRange(2,1,gameState.gameMediaArrayLength,4).setValues(outputHighlights);

  return [gameState, outputHighlights]
}



function postGameVideo(gameState) {
  Logger.log("=== postGameVideo Evaluation ===");
  Logger.log("mediaActive status: " + gameState.mediaActive);
  Logger.log("Current latest highlight: " + gameState.highlightHeadline);
  Logger.log("Duration: " + gameState.highlightDuration + " | Link: " + gameState.highlightLink);
  Logger.log("Queued video link: " + gameState.queuedVideoLink);

  if (gameState.highlightHeadline != previousGameState.highlightHeadline) {
    //writeMediaLog(gameState.highlightDuration, gameState.highlightOutput)
    Logger.log("=> NEW HIGHLIGHT DETECTED.");

    var [hour, min, sec] = gameState.highlightDuration.split(":")
    let scoringPlayTerms = ['homer','RBI','double','single','score','run','triple','home run','homerun','sac fly', 'sacrifice fly', 'grand slam', 'walks it off', 'walk-off', 'win']

    let scoringPlay = false;
    let searchContent = (gameState.highlightHeadline + " " + (gameState.highlightDescription || "")).toLowerCase();
    
    for (let i = 0; i < scoringPlayTerms.length; i++) {
      let term = scoringPlayTerms[i].toLowerCase()
      if (searchContent.search(term) != -1) {
        // Exclude "double play" from triggering "double"
        if (term === 'double' && searchContent.includes('double play')) {
          continue;
        }
        // Exclude "runs down" from triggering "run"
        if (term === 'run' && (searchContent.includes('run down') || searchContent.includes('runs down'))) {
          continue;
        }
        scoringPlay = true;
        Logger.log('   - Scoring play term found: ' + scoringPlayTerms[i])
        break;
      }
    }

    let defensivePlayTerms = ['barehand', 'catch', 'caught stealing', 'clean inning', 'climbs the ladder', 'dart', 'defensive', 'deflected', 'diving', 'double play', 'escapes', 'fans', 'fanning', 'fly out', 'force out', 'foul ball', 'foul territory', 'foul tip', 'glove', 'gunned down', 'induces', 'jam', 'k', "k's", 'nabs', 'out at', 'pick', 'pick off', 'picks off', 'retires', 'retires the side', 'robbed', 'rockies fan', 'robs', 'save', 'scoreless', 'seals the win', 'sits down', 'snag', 'stop', 'strikeout', 'strikes out', 'striking out the side', 'throw', 'throws out', 'turns two'];
    let defensivePlay = false;
    
    for (let i = 0; i < defensivePlayTerms.length; i++) {
      if (searchContent.search(defensivePlayTerms[i].toLowerCase()) != -1) {
        defensivePlay = true;
        Logger.log('   - Defensive play term found: ' + defensivePlayTerms[i])
        break;
      }
    }

    var isShortVideo = (min == '00');
    var isFinal = (gameState.detailedState == 'Final' || gameState.detailedState == 'Game Over');

    // Priority 1: Scoring or Final plays are always queued.
    if (isShortVideo && (scoringPlay || isFinal)) { // This is for scoring plays
      Logger.log("   - Video qualifies! Queueing it up for posting.");
      gameState.queuedVideoHeadline = gameState.highlightHeadline;
      gameState.queuedVideoLink = gameState.highlightLink;
      gameState.queuedVideoDuration = gameState.highlightDuration;
      gameState.queuedVideoOutput = gameState.highlightOutput;
      gameState.queuedVideoDescription = gameState.highlightDescription;
      // Activate media flag for the main posting loop
      gameState.mediaActive = true;
      // Set mediaTeam/Synonym for the queued scoring play
      gameState.mediaTeam = setMediaTeam(gameState);
      gameState.mediaSynonym = 'wentOkSynonym'; // Default for scoring plays
    }
    // Priority 2: Defensive plays post immediately ONLY if no scoring play is currently queued.
    else if (isShortVideo && defensivePlay) {
      if (!gameState.queuedVideoLink) { // Check if a scoring video is NOT already queued
        
        // Temporarily determine mediaTeam/Synonym for this defensive post
        let tempMediaTeam = (gameState.inningState == 'Top' || gameState.inningState == 'Middle') ? gameState.homeTeam : gameState.awayTeam;

        if (tempMediaTeam === 'Colorado Rockies') {
          Logger.log("   - Rockies defensive video qualifies! Posting it immediately as standalone.");
          let tempMediaSynonym = 'wentOkSynonym'; // Or a new defensive synonym list
          
          // Construct the message for the defensive play
          const videoText = (gameState.highlightDescription && gameState.highlightDescription.trim() !== '') 
            ? gameState.highlightDescription 
            : gameState.highlightHeadline;
          let defensiveMessage = `${getSynonym(tempMediaSynonym)}

${allTeamInfo()[tempMediaTeam].teamName} — ${videoText}:`;

          // Download and post the video as a standalone (isReply = false)
          let [blueskyLink, uri, cid] = downloadAndPostVideo(gameState, false, defensiveMessage);

          // Record the post in the "Posts" sheet
          var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Posts");
          var postCount = Number(sheet.getRange(1,8,1,1).getValues());
          var dateTime = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
          sheet.getRange(2 + postCount,1,1,4).setValues([[dateTime, gameState.highlightOutput, gameState.highlightOutput , blueskyLink]]);
          sheet.getRange(1,8,1,1).setValue([Number(postCount + 1)]);
          
          Logger.log("   - Defensive play posted. Not affecting main media queue.");
        } else {
          Logger.log("   - Defensive video qualifies, but was not by the Rockies. Skipping post.");
        }
      } else {
        Logger.log("   - Defensive video qualifies, but a scoring play is already queued. Skipping immediate defensive post.");
      }
    } else {
      Logger.log("   - Video does NOT qualify (Short: " + isShortVideo + ", Scoring/Defensive/Final: " + (scoringPlay || defensivePlay || isFinal) + "). Ignoring.");
    }
  }

  // 2. Attempt to Post Queued Scoring Play (if any)
  if (gameState.mediaActive && gameState.queuedVideoLink) {
    var replyThresholdMet = mediaReplyThreshold(previousGameState.lastPostTime);
    Logger.log("=> We have a queued scoring video waiting: " + gameState.queuedVideoHeadline);
    Logger.log("   - Reply threshold met: " + replyThresholdMet);

    if (replyThresholdMet) {
      Logger.log('=> SUCCESS: Conditions met. Posting queued scoring media reply.');

      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Posts");
      var postCount = Number(sheet.getRange(1,8,1,1).getValues());

      var dateTime = new Date();
      var timezone = Session.getScriptTimeZone();
      dateTime = Utilities.formatDate(dateTime, timezone, "yyyy-MM-dd HH:mm:ss");  


      // Temporarily use the queued video details for posting
      
      let originalLink = gameState.highlightLink;
      let originalHeadline = gameState.highlightHeadline;
      let originalOutput = gameState.highlightOutput;
      let originalDescription = gameState.highlightDescription;
      
      gameState.highlightLink = gameState.queuedVideoLink;
      gameState.highlightHeadline = gameState.queuedVideoHeadline;
      gameState.highlightOutput = gameState.queuedVideoOutput;
      gameState.highlightDescription = gameState.queuedVideoDescription;

      let [blueskyLink, uri, cid] = downloadAndPostVideo(gameState, true); // isReply defaults to true
      
      // Restore original highlight info after posting queued video
      gameState.highlightLink = originalLink;
      gameState.highlightHeadline = originalHeadline;
      gameState.highlightOutput = originalOutput;
      gameState.highlightDescription = originalDescription;

      gameState.mediaActive = false; // Reset mediaActive after posting the queued video
      // Clear all queued video properties
      gameState.queuedVideoLink = null;
      gameState.queuedVideoHeadline = null;
      gameState.queuedVideoDuration = null;
      gameState.queuedVideoOutput = null;
      gameState.queuedVideoDescription = null;

      Logger.log("Outputting to Posts sheet")
      sheet.getRange(2 + postCount,1,1,4).setValues([[dateTime, gameState.queuedVideoOutput, gameState.queuedVideoOutput , blueskyLink]]);
      sheet.getRange(1,8,1,1).setValue(  [Number(postCount + 1)] );
    } else {
      Logger.log('=> SKIPPED POSTING: Waiting for mediaReplyThreshold to be met for queued scoring video.');
    }
  } else {
    if (!gameState.mediaActive) {
      Logger.log("=> SKIPPED POSTING: mediaActive is false.");
      // Ensure queued video is cleared if mediaActive is explicitly false (e.g., after a previous post)
      gameState.queuedVideoLink = null; 
      gameState.queuedVideoHeadline = null;
      gameState.queuedVideoDuration = null;
      gameState.queuedVideoOutput = null;
      gameState.queuedVideoDescription = null;
    } else if (!gameState.queuedVideoLink) {
      Logger.log("=> SKIPPED POSTING: mediaActive is true, but no qualifying scoring video has arrived yet.");
    }
  }

  Logger.log("================================");
  return gameState;

}



function clearCurrentGameMedia() {
  //clear current game media tab
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Current Game Media");
  sheet.getRange(2,1,100,4).clearContent();
}



function writeMediaLog() {
  Logger.log('writeMediaLog')
  Logger.log(gameState)
  gameState = loadPreviousGameState();
  var [gameState, outputHighlights] = processGameHighlights(gameState);
  //highlightOutput = "=HYPERLINK(\"https://mlb-cuts-diamond.mlb.com/FORGE/2025/2025-06/17/cc2992b5-c779d3ef-ef1f4c06-csvm-diamondgcp-asset-4000K.mp4\",\"Antonio Senzatela escapes trouble in the 2nd\")"
  Logger.log(gameState)
  Logger.log(outputHighlights)

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Media Log");
  var postCount = Number(sheet.getRange(1,10,1,1).getValues());

  var timezone = Session.getScriptTimeZone();
  var dateTime = new Date();
  dateTime = Utilities.formatDate(dateTime, timezone, "yyyy-MM-dd HH:mm:ss");
  sheet.getRange(1 + postCount,1,gameState.gameMediaArrayLength,4).setValues(outputHighlights);

  //clear current game media tab
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Current Game Media");
  sheet.getRange(2,1,100,4).clearContent();

  //remove trigger after run
  setGameTrigger(4)

}



function downloadAndPostVideo(gameState, isReply = true, customPostText = null) {
  try {
    gameState = gameState ?? loadPreviousGameState()

    const videoUrl = gameState.highlightLink
    Logger.log('gameState.highlightLink=' + videoUrl)
    Logger.log('gameState.highlightHeadline=' + gameState.highlightHeadline)
    Logger.log('gameState.highlightDescription=' + gameState.highlightDescription)
    Logger.log('gameState.mediaTeam=' + gameState.mediaTeam)

    const fetchOptions = {
      'muteHttpExceptions': true, // Don't throw an exception on HTTP errors
      'timeout': 120 // Set timeout to 120 seconds (2 minutes) for large video files
    };
    //url = 'https://mlb-cuts-diamond.mlb.com/FORGE/2025/2025-08/11/53bbe3ef-99e51b6d-ff1e3854-csvm-diamondgcp-asset_1280x720_59_4000K.mp4'
    //url = 'https://bdata-producedclips.mlb.com/f07110f6-6cff-45cc-b4f3-2989a9ecd3fb.mp4'
    //url = 'https://mlb-cuts-diamond.mlb.com/FORGE/2025/2025-08/16/32a016a6-bc54455f-3a30c29c-csvm-diamondgcp-asset_1280x720_59_4000K.mp4'
    //url = 'https://mlb-cuts-diamond.mlb.com/FORGE/2025/2025-08/16/4bb5f698-7e8ed0df-fc3bfffa-csvm-diamondgcp-asset_1280x720_59_4000K.mp4'
    //url = 'https://bdata-producedclips.mlb.com/dfda3a1d-6ac0-4cee-a9f2-e67c0c3db3bf.mp4'

  let blobLarge = null; // Declare and initialize outside try-catch

  try {
    const response = UrlFetchApp.fetch(videoUrl, fetchOptions);
    Logger.log('Video fetch response code=' + response.getResponseCode());
    if (response.getResponseCode() >= 400) {
      Logger.log(`Error fetching video from MLB. Status: ${response.getResponseCode()}. Response: ${response.getContentText()}`);
    } else {
      blobLarge = response.getBlob();
      Logger.log('Video downloaded from MLB. Size=' + blobLarge.getBytes().length + ' bytes, type=' + blobLarge.getContentType());
    }
  } catch (error) {
    Logger.log('Exception during video fetch from MLB: ' + error.toString());
  }

  if (blobLarge === null) {
    Logger.log('Unable to download video blob, aborting video post.');
    return [null, null, null];
  }


  //Logger.log('downloaded blob')
  //Logger.log(blobLarge)

  //Logger.log('blobLarge=' + blobLarge)
  //blobLargeID = createFile(blobLarge)

  //Logger.log(blobLarge)

  var width = 400; // Please set the size of width with the unit of pixels.
  var outputFilename = "tempBlueskyVideo.mp4"; // Please set the output filename.

  var dir = DriveApp.getFoldersByName('BlueskyImages').next();
  //var fileId = dir.createFile(blobLarge).getId();
  //var link = Drive.Files.get(fileId).thumbnailLink;

  //Logger.log(link)


  if (gameState.highlightHeadline && gameState.highlightHeadline[gameState.highlightHeadline.length-1] == '.') {
    gameState.highlightHeadline = gameState.highlightHeadline.substring(0, gameState.highlightHeadline.length - 1)
  }

  Logger.log('Calling uploadVideoRecommended with video payload size=' + blobLarge.getBytes().length + ' bytes, mimeType=' + blobLarge.getContentType());

  let uploadResult = null;
  try {
    uploadResult = uploadVideoRecommended(blobLarge.getBytes(), blobLarge.getContentType());
    Logger.log('uploadVideoRecommended returned: ' + JSON.stringify(uploadResult));
  } catch (e) {
    Logger.log('uploadVideoRecommended threw an exception: ' + e.toString());
    return [null, null, null];
  }

  const videoBlob = uploadResult && uploadResult.blob ? uploadResult.blob : null;
  if (!videoBlob || !videoBlob.ref) {
    Logger.log('No usable video blob available from recommended upload. Aborting. Result=' + JSON.stringify(uploadResult));
    return [null, null, null];
  }

  Logger.log('videoBlob prepared for embed: ' + JSON.stringify(videoBlob));
  
  let messageToPost;
  if (customPostText) {
    messageToPost = customPostText;
  } else {
    const videoText = (gameState.highlightDescription && gameState.highlightDescription.trim() !== '') 
      ? gameState.highlightDescription 
      : gameState.highlightHeadline;

    messageToPost = `${getSynonym(gameState.mediaSynonym)}

${allTeamInfo()[gameState.mediaTeam].teamName} — ${videoText}:`
  }

  record = {
    text: messageToPost,
    langs: ["en"],
    createdAt: (new Date()).toISOString(),
    embed: {
      $type: 'app.bsky.embed.video',
      video: videoBlob,
      aspectRatio: {
        width: 1280,
        height: 720
      }
    }
  }

  let blueskyLink, uri, cid;
  try {
    if (isReply && gameState.lastPostParentUri && gameState.lastPostParentCid) {
      [blueskyLink, uri, cid] = post(record, {uri: gameState.lastPostParentUri, cid: gameState.lastPostParentCid}, {uri: gameState.lastPostParentUri, cid: gameState.lastPostParentCid});
    } else {
      [blueskyLink, uri, cid] = post(record, undefined, undefined);
    }
  } catch (e) {
    Logger.log('Exception while posting video record: ' + e.toString());
    return [null, null, null];
  }

  Logger.log('downloadAndPostVideo result: blueskyLink=' + blueskyLink + ', uri=' + uri + ', cid=' + cid);
  return [blueskyLink, uri, cid]

  } catch (e) {
    Logger.log('downloadAndPostVideo exception: ' + e.toString());
    return [null, null, null];
  }
}



function testTruncateString() {
let highlightHeadline = 'Ketel Marte doubles (18) on a sharp line drive to center fielder Brenton Doyle. Jose Herrera scores. Geraldo Perdomo scores.'
Logger.log(highlightHeadline)
    if (highlightHeadline[highlightHeadline.length-1] == '.') {
    highlightHeadline = highlightHeadline.substring(0, highlightHeadline.length - 1)
  }

Logger.log(highlightHeadline)

}


function setMediaTeam(gameState) {
  if (gameState.inningState == 'Top' || gameState.inningState == 'Middle' ) {
    gameState.mediaTeam = gameState.awayTeam
  }
  else // if (gameState.inningState == 'Bottom' || gameState.inningState == 'End' )
  {
    gameState.mediaTeam = gameState.homeTeam
  }
  return gameState.mediaTeam
}


function testMediaTeam(gameState) {
  gameState = gameState ?? loadPreviousGameState()
  //Logger.log(gameState[gameState.myTeamHomeStatus + 'Team'])
  //Logger.log(gameState[gameState.opponentHomeStatus + 'Team'])

  //allTeamInfo = allTeamInfo()

  if (gameState.inningState == 'Top' || gameState.inningState == 'Middle' ) {
    gameState.mediaTeam = gameState.awayTeam
  }
  else // if (gameState.inningState == 'Bottom' || gameState.inningState == 'End' )
  {
    gameState.mediaTeam = gameState.homeTeam
  }

  Logger.log(allTeamInfo()[gameState.mediaTeam].clubName)

}
