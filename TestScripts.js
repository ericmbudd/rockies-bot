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

function testPostGamedayLink() {
  const gamedayUrl = 'https://www.mlb.com/gameday/824371';
  const ogImageUrl = 'https://midfield.mlbstatic.com/v1/teams-matchup/119-115/ar_16:9/w_1440';

  Logger.log('Testing gameday link post with URL: ' + gamedayUrl);

  // First, verify what getUrlInfo scrapes for this URL
  const urlInfo = getUrlInfo(gamedayUrl);
  Logger.log('=== getUrlInfo result ===');
  Logger.log('title: ' + urlInfo.title);
  Logger.log('description: ' + urlInfo.description);
  Logger.log('imageUrl (scraped): ' + urlInfo.imageUrl);
  Logger.log('Expected og:image: ' + ogImageUrl);
  Logger.log('og:image matches expected: ' + (urlInfo.imageUrl === ogImageUrl));

  // Use the correct og:image URL for the thumbnail
  const thumbImageUrl = ogImageUrl;
  Logger.log('Creating thumbnail from: ' + thumbImageUrl);
  const thumb = createThumb(thumbImageUrl);
  if (!thumb) {
    Logger.log('ERROR: Could not create thumbnail from og:image URL');
    return;
  }
  Logger.log('Thumbnail created successfully: ' + JSON.stringify(thumb));

  const postText = 'Rockies vs Dodgers - Follow along: ' + gamedayUrl;
  const urlLocStart = postText.indexOf(gamedayUrl);
  const urlLocEnd = urlLocStart + gamedayUrl.length;
  const byteStart = getByteLength(postText.substring(0, urlLocStart));
  const byteEnd = getByteLength(postText.substring(0, urlLocEnd));

  const record = {
    text: postText,
    langs: ["en"],
    createdAt: (new Date()).toISOString(),
    facets: [{
      index: { byteStart: byteStart, byteEnd: byteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: gamedayUrl }]
    }],
    embed: {
      $type: 'app.bsky.embed.external',
      external: {
        uri: gamedayUrl,
        title: urlInfo.title || 'MLB Gameday',
        description: urlInfo.description || '',
        thumb: thumb
      }
    }
  };

  Logger.log('=== RECORD DEBUG ===');
  Logger.log('Full record: ' + JSON.stringify(record));

  const [blueskyLink, uri, cid] = post(record, undefined, undefined);
  Logger.log('Bluesky post created: ' + blueskyLink);
}

// Renamed testUploadVideoRecommended to testUploadVideoSimple for consistency with the request
function testUploadVideoRecommended() {
  //play from https://statsapi.mlb.com/api/v1/game/824370/content
  const sampleVideoUrl = 'https://mlb-cuts-diamond.mlb.com/FORGE/2026/2026-04/20/c7272ed6-bd39d0be-b19c9fc4-csvm-diamondgcp-asset_1280x720_59_4000K.mp4';
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
      Logger.log('Video downloaded successfully. Size: ' + videoBlob.getBytes().length + ' bytes, type: ' + videoBlob.getContentType());
      // Normalize unsupported MIME types to video/mp4 (same logic as downloadAndPostVideo)
      const supportedMimeTypes = ['video/mp4', 'video/mpeg', 'video/webm', 'video/quicktime', 'image/gif'];
      if (!supportedMimeTypes.includes(videoBlob.getContentType())) {
        Logger.log('Unsupported MIME type: ' + videoBlob.getContentType() + '. Normalizing to video/mp4.');
        videoBlob.setContentType('video/mp4');
      }
    }
  } catch (e) {
    Logger.log('Exception during video download: ' + e.toString());
  }

  if (!videoBlob) {
    Logger.log('Video blob is null, cannot proceed with upload.');
    return;
  }
  
  Logger.log('Uploading video to Bluesky using uploadVideoRecommended...');
  // Patch ftyp box bytes before upload (handles M4V files served with .mp4 extension)
  const patchedBytes = patchFtypBox(videoBlob.getBytes());
  const uploadResult = uploadVideoRecommended(patchedBytes, videoBlob.getContentType());
  
  if (uploadResult && uploadResult.blob) {
    Logger.log('=== UPLOAD RESULT DEBUG ===');
    Logger.log('Full uploadResult: ' + JSON.stringify(uploadResult));
    Logger.log('uploadResult.blob keys: ' + Object.keys(uploadResult.blob).join(', '));
    Logger.log('uploadResult.blob.$type: ' + uploadResult.blob.$type);
    Logger.log('uploadResult.blob.ref: ' + JSON.stringify(uploadResult.blob.ref));
    Logger.log('uploadResult.blob.mimeType: ' + uploadResult.blob.mimeType);
    Logger.log('uploadResult.blob.size: ' + uploadResult.blob.size);
    
    const postText = "Willi Castro's nifty diving stop — Rockies defensive play test";
    
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