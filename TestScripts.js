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

// Renamed testUploadVideoRecommended to testUploadVideoSimple for consistency with the request
function testUploadVideoRecommended() {
  const sampleVideoUrl = 'https://bdata-producedclips.mlb.com/5074eaba-74fe-477d-8a5e-4768527f1b17.mp4';
  Logger.log('Attempting to download video from: ' + sampleVideoUrl);

  const fetchOptions = {
    'muteHttpExceptions': true,
    'timeout': 120 // 2 minutes timeout for download
  };

  let videoBlob = null;
  try {
    const response = UrlFetchApp.fetch(sampleVideoUrl, fetchOptions);
    if (response.getResponseCode() >= 400) {
      Logger.log(`Error fetching video. Status: ${response.getResponseCode()}. Response: ${response.getContentText()}`);
    } else {
      videoBlob = response.getBlob();
      Logger.log('Video downloaded successfully. Size: ' + videoBlob.getBytes().length + ' bytes');
    }
  } catch (e) {
    Logger.log('Exception during video download: ' + e.toString());
  }

  if (!videoBlob) {
    Logger.log('Video blob is null, cannot proceed with upload.');
    return;
  }
  
  Logger.log('Uploading video to Bluesky using uploadVideoRecommended...');
  const uploadResult = uploadVideoRecommended(videoBlob.getBytes(), videoBlob.getContentType());
  
  if (uploadResult && uploadResult.blob) {
    Logger.log('=== UPLOAD RESULT DEBUG ===');
    Logger.log('Full uploadResult: ' + JSON.stringify(uploadResult));
    Logger.log('uploadResult.blob keys: ' + Object.keys(uploadResult.blob).join(', '));
    Logger.log('uploadResult.blob.$type: ' + uploadResult.blob.$type);
    Logger.log('uploadResult.blob.ref: ' + JSON.stringify(uploadResult.blob.ref));
    Logger.log('uploadResult.blob.mimeType: ' + uploadResult.blob.mimeType);
    Logger.log('uploadResult.blob.size: ' + uploadResult.blob.size);
    
    const postText = "Brenton Doyle scores on Mickey Moniak's forceout as the Rockies' extend their lead to 9-4 in the bottom of the 8th inning";
    
    const videoEmbedObject = uploadResult.blob;
    if (videoEmbedObject && !videoEmbedObject.$type) {
      videoEmbedObject.$type = 'blob';
    }

    const embed = {
      $type: 'app.bsky.embed.video',
      video: videoEmbedObject,
      aspectRatio: { width: 1280, height: 720 }
    };

    Logger.log('=== EMBED DEBUG ===');
    Logger.log('Full embed object: ' + JSON.stringify(embed));

    const record = {
      text: postText,
      langs: ["en"],
      createdAt: (new Date()).toISOString(),
      embed: embed,
      facets: []
    };

    Logger.log('=== RECORD DEBUG ===');
    Logger.log('Full record: ' + JSON.stringify(record));

    // Log what PDS endpoint post() will use
    const debugLoadedData = loadData();
    const debugPdsInfo = getPdsInfo(debugLoadedData);
    Logger.log('=== POST ENDPOINT DEBUG ===');
    Logger.log('post() will use PDS endpoint: ' + debugPdsInfo.pdsEndpoint);
    Logger.log('post() will use DID: ' + debugLoadedData.did);
    Logger.log('post() PDS DID: ' + debugPdsInfo.pdsDid);

    const [blueskyLink, uri, cid] = post(record, undefined, undefined);
    Logger.log('Bluesky post created: ' + blueskyLink);
  } else {
    Logger.log('Video upload failed or returned no blob data.');
  }
}

function testUploadVideoSimple() {
  const sampleVideoUrl = 'https://bdata-producedclips.mlb.com/1eebf4df-57da-4831-b9b2-eaf005b64655.mp4';
  Logger.log('Attempting to download video from: ' + sampleVideoUrl);

  const fetchOptions = {
    'muteHttpExceptions': true,
    'timeout': 120 // 2 minutes timeout for download
  };

  let videoBlob = null;
  try {
    const response = UrlFetchApp.fetch(sampleVideoUrl, fetchOptions);
    if (response.getResponseCode() >= 400) {
      Logger.log(`Error fetching video. Status: ${response.getResponseCode()}. Response: ${response.getContentText()}`);
    } else {
      videoBlob = response.getBlob();
      Logger.log('Video downloaded successfully. Size: ' + videoBlob.getBytes().length + ' bytes');
    }
  } catch (e) {
    Logger.log('Exception during video download: ' + e.toString());
  }

  if (!videoBlob) {
    Logger.log('Video blob is null, cannot proceed with upload.');
    return;
  }

  Logger.log('Uploading video to Bluesky using uploadVideoSimple...');
  const uploadResult = uploadVideoSimple(videoBlob.getBytes(), videoBlob.getContentType());
  
  if (uploadResult && uploadResult.blob) {
    Logger.log('Video uploaded successfully. Blob details: ' + JSON.stringify(uploadResult.blob));
    
    const postText = "Mickey Moniak makes the catch in left field to strand runners on the corners and end the top of the 6th inning";
    
    const record = {
      text: postText,
      langs: ["en"],
      createdAt: (new Date()).toISOString(),
      embed: {
        $type: 'app.bsky.embed.video',
        video: uploadResult.blob, // uploadResult.blob already contains $type, ref, size, mimeType
        aspectRatio: { width: 1280, height: 720 } // Default aspect ratio
      },
      facets: [] // No specific facets for this test post
    };
    const [blueskyLink, uri, cid] = post(record, undefined, undefined); // Standalone post
    Logger.log('Bluesky post created: ' + blueskyLink);
  } else {
    Logger.log('Video upload failed or returned no blob data.');
  }
}

function testUploadVideoSimple() {
  const sampleVideoUrl = 'https://bdata-producedclips.mlb.com/1eebf4df-57da-4831-b9b2-eaf005b64655.mp4';
  Logger.log('Attempting to download video from: ' + sampleVideoUrl);

  const fetchOptions = {
    'muteHttpExceptions': true,
    'timeout': 120 // 2 minutes timeout for download
  };

  let videoBlob = null;
  try {
    const response = UrlFetchApp.fetch(sampleVideoUrl, fetchOptions);
    if (response.getResponseCode() >= 400) {
      Logger.log(`Error fetching video. Status: ${response.getResponseCode()}. Response: ${response.getContentText()}`);
    } else {
      videoBlob = response.getBlob();
      Logger.log('Video downloaded successfully. Size: ' + videoBlob.getBytes().length + ' bytes');
    }
  } catch (e) {
    Logger.log('Exception during video download: ' + e.toString());
  }

  if (!videoBlob) {
    Logger.log('Video blob is null, cannot proceed with upload.');
    return;
  }

  Logger.log('Uploading video to Bluesky using uploadVideoSimple...');
  const uploadResult = uploadVideoSimple(videoBlob.getBytes(), videoBlob.getContentType());

  if (uploadResult && uploadResult.blob) {
    Logger.log('Video uploaded successfully. Blob details: ' + JSON.stringify(uploadResult.blob));
    
    const postText = "Mickey Moniak makes the catch in left field to strand runners on the corners and end the top of the 6th inning";
    
    const record = {
      text: postText,
      langs: ["en"],
      createdAt: (new Date()).toISOString(),
      embed: {
        $type: 'app.bsky.embed.video',
        video: uploadResult.blob, // uploadResult.blob already contains $type, ref, size, mimeType
        aspectRatio: { width: 1280, height: 720 } // Default aspect ratio
      },
      facets: [] // No specific facets for this test post
    };
    const [blueskyLink, uri, cid] = post(record, undefined, undefined); // Standalone post
    Logger.log('Bluesky post created: ' + blueskyLink);
  } else {
    Logger.log('Video upload failed or returned no blob data.');
  }
}