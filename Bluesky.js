function getFeedGenerator(feedURI) {
  const loadedData = loadData();
  const accessJwt = loadedData.accessJwt;

  //hardcoded hack
  feedURI = 'at://did:plc:dkanfr5ivoi3hat7pz6fjiat/app.bsky.feed.generator/coloradorox'
  //feedURI = 'at://did:plc:dkanfr5ivoi3hat7pz6fjiat/app.bsky.feed.generator/playoffmlb' 
  const url = 'https://bsky.social/xrpc/app.bsky.feed.getFeedGenerator?feed=' + encodeURIComponent(feedURI);

  const options = {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + accessJwt
    }
  };

  const response = UrlFetchApp.fetch(url, options);
  Logger.log(response)
  return JSON.parse(response.getContentText());
}


function getByteLength(str) {
  return Utilities.newBlob(str).getBytes().length;
}

function loadData() {
  const url = 'https://bsky.social/xrpc/com.atproto.server.createSession';

  const data = {
    'identifier': 'didtherockieslose.com', //'TestBotEricmbudd',
    'password': 'afnv-trwh-e6gx-o7cc'
  };

  const options = {
    'method': 'post',
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
    },
    'payload': JSON.stringify(data),
    'muteHttpExceptions': true // Add this for robustness
  };

  let sessionResponse;
  try {
    sessionResponse = UrlFetchApp.fetch(url, options);
  } catch (e) {
    Logger.log('Error fetching session data: ' + e.toString());
    throw new Error("Failed to create Bluesky session.");
  }

  const sessionCode = sessionResponse.getResponseCode();
  const sessionText = sessionResponse.getContentText();

  if (sessionCode >= 400) {
    Logger.log(`Error creating Bluesky session. Status: ${sessionCode}. Response: ${sessionText}`);
    throw new Error("Failed to create Bluesky session.");
  }
  const sessionData = JSON.parse(sessionText);
  Logger.log('Bluesky session created successfully. DID: ' + sessionData.did);

  // Fetch didDoc to get PDS service endpoint
  try {
    const describeRepoUrl = `https://bsky.social/xrpc/com.atproto.repo.describeRepo?repo=${sessionData.did}`;
    const describeRepoOptions = {
      'headers': {
        'Authorization': 'Bearer ' + sessionData.accessJwt
      },
      'muteHttpExceptions': true // Add this for robustness
    };
    const describeRepoResponse = UrlFetchApp.fetch(describeRepoUrl, describeRepoOptions);
    const describeRepoCode = describeRepoResponse.getResponseCode();
    const describeRepoText = describeRepoResponse.getContentText();

    if (describeRepoCode >= 400) {
      Logger.log(`Error fetching didDoc. Status: ${describeRepoCode}. Response: ${describeRepoText}`);
      sessionData.didDoc = null; // Explicitly null on error
    } else {
      sessionData.didDoc = JSON.parse(describeRepoText);
      Logger.log('didDoc fetched successfully: ' + JSON.stringify(sessionData.didDoc));
    }
  } catch (e) {
    Logger.log('Exception fetching didDoc: ' + e.toString());
    sessionData.didDoc = null; // Ensure it's explicitly null if fetching fails
  }
  
  if (!sessionData.didDoc) {
    Logger.log('Warning: didDoc could not be fetched. This might affect video uploads if PDS DID cannot be determined.');
  }

  return sessionData;
}

function getPdsInfo(loadedData) {
  let pdsEndpoint = 'https://bsky.social';
  let pdsDid = '';
  let pdsDoc = null;

  if (loadedData && loadedData.didDoc) {
    pdsDoc = loadedData.didDoc.didDoc || loadedData.didDoc;
  }

  if (pdsDoc && pdsDoc.service && Array.isArray(pdsDoc.service)) {
    const pdsService = pdsDoc.service.find(s => {
      if (!s) return false;
      const id = (s.id || '').toString().toLowerCase();
      const type = (s.type || '').toString().toLowerCase();
      return id === '#atproto_pds' || id === '#pds' || type === 'atprotopersonaldataserver' || type === 'atproto_pds' || type === 'atprotopds' || type === 'pds';
    });

    if (pdsService && pdsService.serviceEndpoint) {
      pdsEndpoint = Array.isArray(pdsService.serviceEndpoint)
        ? pdsService.serviceEndpoint[0]
        : pdsService.serviceEndpoint;
    }
  }

  const hostnameMatch = pdsEndpoint.toString().match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/i);
  if (hostnameMatch && hostnameMatch[1]) {
    pdsDid = `did:web:${hostnameMatch[1]}`;
  }

  return { pdsEndpoint, pdsDid };
}

function getUrlInfo(url) {
  const fallbackImageUrl = 'https://builds.mlbstatic.com/mlb.com/builds/site-core/1606751303311/dist/images/favicon.png';
  let content;
  let imageUrl;
  let title = '';
  let description = '';
  
  try {
    content = UrlFetchApp.fetch(url).getContentText();
    const $ = Cheerio.load(content);

    imageUrl = $('meta[property="og:image"]').attr('content');
    if (imageUrl === undefined) {
      imageUrl = $('meta[name="twitter:image"]').attr('content');
    }
    if (imageUrl === undefined) {
      imageUrl = $('.wp-block-image img').attr('src');
    }

    title = $('title').text();
    description = $('meta[name="description"]').attr('content');
    if (description === undefined) {
      description = $('meta[property="og:description"]').attr('content');
    }
    if (description === undefined) {
      description = $('meta[name="twitter:title"]').attr('content');
    }
    if (description === undefined) {
      description = $('title').text().trim();
    }
  } catch (error) {
    Logger.log('Error fetching URL info for: ' + url);
    Logger.log(error)
    // If fetching fails, use fallback image and empty title/description
    imageUrl = fallbackImageUrl;
    title = '';
    description = '';
  }

  // Ensure imageUrl is always set, even if not found in metadata
  if (imageUrl === undefined || imageUrl === '') {
    imageUrl = fallbackImageUrl;
  }
  
  return {
    'title': title,
    'description': description,
    'imageUrl': imageUrl
  }
}

function getImageAndShrink(imageUrl) {
  var blob, file, fileId, link, blob2;
  try {
    blob = UrlFetchApp.fetch(imageUrl).getBlob();
    if (!blob) {
        Logger.log('Failed to fetch image blob from: ' + imageUrl);
        return null;
    }
    blob.setName("temp_thumb_" + new Date().getTime());
  } catch (error) {
    Logger.log('Error fetching image for shrinking: ' + error.toString());
    Logger.log('Image URL: ' + imageUrl);
    return null;
  }

  try {
    // Note: This requires the Advanced Drive API service to be enabled in the Apps Script editor.
    file = Drive.Files.insert({ title: blob.getName() }, blob, { supportsAllDrives: true });
    fileId = file.id;
    
    // The thumbnailLink can take a few moments to generate.
    // We'll poll for it a few times with a delay.
    for (let i = 0; i < 5; i++) {
        file = Drive.Files.get(fileId, { supportsAllDrives: true });
        if (file.thumbnailLink) {
            break;
        }
        Logger.log('Thumbnail link not available yet for fileId: ' + fileId + '. Waiting...');
        Utilities.sleep(2000); // Wait 2 seconds
    }

    if (!file.thumbnailLink) {
        Logger.log('Thumbnail link could not be generated for fileId: ' + fileId);
        Drive.Files.remove(fileId, { supportsAllDrives: true });
        return null;
    }

    var width = 400;
    var outputFilename = "tempBluesky3.png"; // The thumbnail is always PNG
    link = file.thumbnailLink.replace(/\=s.+/, "=s" + width);
    blob2 = UrlFetchApp.fetch(link).getBlob().setName(outputFilename);

  } catch (e) {
    Logger.log('Error during Drive operations for image shrinking: ' + e.toString());
    if (fileId) {
      try { Drive.Files.remove(fileId, { supportsAllDrives: true }); } catch (removeError) { /* ignore */ }
    }
    return null;
  } finally {
    if (fileId) {
      try { Drive.Files.remove(fileId, { supportsAllDrives: true }); } catch (removeError) { /* ignore */ }
    }
  }

  return blob2;
}


function uploadForImageLink(imageUrl) {
  const loadedData = loadData();
  const accessJwt = loadedData.accessJwt;
  var blob = getImageAndShrink(imageUrl);
  
  if (!blob) {
    Logger.log('uploadForImageLink: Could not get image blob from URL: ' + imageUrl);
    return null;
  }

  const options = {
    'method': 'post',
    'headers': {
      'Authorization': 'Bearer ' + accessJwt,
      'Content-Type': blob.getContentType()
    },
    'payload': blob.getBytes(),
    'muteHttpExceptions': true
  };

  const url = 'https://bsky.social/xrpc/com.atproto.repo.uploadBlob';
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode >= 400) {
    Logger.log(`Error uploading image blob. Status: ${responseCode}. Response: ${responseText}`);
    return null;
  }

  return JSON.parse(responseText);
}

//mimeType
//video/x-m4v
//video/mp4

function uploadVideoSimple(blob, mimeType = 'video/mp4') {
  const loadedData = loadData();
  const accessJwt = loadedData.accessJwt;
  const { pdsEndpoint } = getPdsInfo(loadedData);
  const options = {
    'method': 'post',
    'headers': {
      'Authorization': 'Bearer ' + accessJwt,
      'Content-Type': mimeType
    },
    'payload': blob,
    'muteHttpExceptions': true
  };

  const url = pdsEndpoint + '/xrpc/com.atproto.repo.uploadBlob';

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    Logger.log('uploadVideoSimple response code=' + responseCode + ' body=' + responseText);

    if (responseCode >= 400) {
      Logger.log(`uploadVideoSimple failed: ${responseCode} ${responseText}`);
      return null;
    }

    try {
      return JSON.parse(responseText);
    } catch (e) {
      Logger.log('Error parsing uploadVideoSimple response: ' + e.toString());
      return null;
    }
  } catch (e) {
    Logger.log('Error in uploadVideoSimple: ' + e.toString());
    return null;
  }
}

function uploadVideoRecommended(blob, mimeType = 'video/mp4') {
  // Normalize unsupported MIME types to supported ones
  if (mimeType === 'video/x-m4v' || mimeType === 'video/m4v') {
    mimeType = 'video/mp4';
  }

  const loadedData = loadData();
  const accessJwt = loadedData.accessJwt;
  const did = loadedData.did;
  const { pdsEndpoint, pdsDid } = getPdsInfo(loadedData);

  Logger.log('=== uploadVideoRecommended CONFIG ===');
  Logger.log('User DID: ' + did);
  Logger.log('PDS Endpoint: ' + pdsEndpoint);
  Logger.log('PDS DID (aud): ' + pdsDid);

  if (!pdsDid) {
    Logger.log('PDS DID could not be determined from didDoc. Video upload will not proceed with an invalid audience.');
    throw new Error('Unable to determine PDS DID from didDoc for video upload auth token.');
  }

  const exp = Math.floor(Date.now() / 1000) + (60 * 30); // 30 minutes
  const authOptions = {
    'method': 'get',
    'headers': {
      'Authorization': 'Bearer ' + accessJwt
    },
    'muteHttpExceptions': true
  };

  let uploadVideoToken;
  const uploadAuthUrl = pdsEndpoint + '/xrpc/com.atproto.server.getServiceAuth?aud=' + encodeURIComponent(pdsDid) + '&lxm=com.atproto.repo.uploadBlob&exp=' + exp;
  try {
    Logger.log('Fetching video upload auth token for PDS DID: ' + pdsDid + ' via ' + pdsEndpoint);
    const uploadAuthResponseRaw = UrlFetchApp.fetch(uploadAuthUrl, authOptions);
    const uploadAuthCode = uploadAuthResponseRaw.getResponseCode();
    const uploadAuthText = uploadAuthResponseRaw.getContentText();
    if (uploadAuthCode >= 400) {
      Logger.log(`Error fetching video upload auth token. Status: ${uploadAuthCode}. Response: ${uploadAuthText}`);
      throw new Error('Failed to get video upload auth token.');
    }
    uploadVideoToken = JSON.parse(uploadAuthText).token;
  } catch (e) {
    Logger.log('Error fetching video upload auth token: ' + e.toString());
    throw new Error('Failed to get video upload auth token.');
  }

  Logger.log('Uploading video blob to Bluesky video service...');
  const uploadUrl = 'https://video.bsky.app/xrpc/app.bsky.video.uploadVideo?did=' + encodeURIComponent(did) + '&name=video.mp4';
  const uploadOptions = {
    'method': 'post',
    'headers': {
      'Authorization': 'Bearer ' + uploadVideoToken,
      'Content-Type': mimeType
    },
    'payload': blob,
    'muteHttpExceptions': true,
    'timeout': 120
  };

  let uploadResponseRaw;
  try {
    Logger.log('Sending video upload request to: ' + uploadUrl);
    Logger.log('Video blob size: ' + (blob.length || blob.byteLength || 0) + ' bytes');
    uploadResponseRaw = UrlFetchApp.fetch(uploadUrl, uploadOptions);
  } catch (e) {
    Logger.log('Error during video upload to Bluesky video service: ' + e.toString());
    throw new Error('Video upload to Bluesky video service failed.');
  }

  const responseCode = uploadResponseRaw.getResponseCode();
  const uploadResponseText = uploadResponseRaw.getContentText();
  Logger.log('uploadVideoRecommended response code=' + responseCode + ' body=' + uploadResponseText);

  let uploadResponse;
  try {
    uploadResponse = JSON.parse(uploadResponseText);
  } catch (e) {
    throw new Error('Video upload returned non-JSON response: ' + uploadResponseText);
  }

  if (responseCode !== 200 && responseCode !== 409) {
    throw new Error('Video upload failed: ' + uploadResponseText);
  }

  let processedBlob = uploadResponse.blob || null;
  if (processedBlob) {
    if (!processedBlob.$type) {
      processedBlob.$type = 'blob';
    }
    Logger.log('Video service returned blob immediately.');
    return { blob: processedBlob };
  }

  const jobId = uploadResponse.jobId;
  Logger.log('Video uploaded to video.bsky.app. Job ID: ' + jobId + (responseCode === 409 ? ' (Already processed)' : ''));

  if (!jobId) {
    throw new Error('Video upload response did not include a jobId or blob.');
  }

  let statusVideoToken;
  const statusAuthUrl = pdsEndpoint + '/xrpc/com.atproto.server.getServiceAuth?aud=' + encodeURIComponent(pdsDid) + '&lxm=app.bsky.video.getJobStatus&exp=' + exp;
  try {
    Logger.log('Fetching video status auth token for PDS DID: ' + pdsDid + ' via ' + pdsEndpoint);
    const statusAuthResponseRaw = UrlFetchApp.fetch(statusAuthUrl, authOptions);
    const statusAuthCode = statusAuthResponseRaw.getResponseCode();
    const statusAuthText = statusAuthResponseRaw.getContentText();
    if (statusAuthCode >= 400) {
      Logger.log(`Error fetching video status auth token. Status: ${statusAuthCode}. Response: ${statusAuthText}`);
      throw new Error('Failed to get video status auth token.');
    }
    statusVideoToken = JSON.parse(statusAuthText).token;
  } catch (e) {
    Logger.log('Error fetching video status auth token: ' + e.toString());
    throw new Error('Failed to get video status auth token.');
  }

  Logger.log('Polling for video processing status...');
  const statusUrl = 'https://video.bsky.app/xrpc/app.bsky.video.getJobStatus?jobId=' + encodeURIComponent(jobId);
  const statusOptions = {
    'method': 'get',
    'headers': {
      'Authorization': 'Bearer ' + statusVideoToken
    },
    'muteHttpExceptions': true
  };

  let retries = 0;
  const maxRetries = 60;
  while (retries < maxRetries) {
    if (retries > 0) {
      Logger.log(`Waiting for video processing... Attempt ${retries + 1}/${maxRetries}`);
    }

    Utilities.sleep(1000);
    const statusResponseRaw = UrlFetchApp.fetch(statusUrl, statusOptions);
    const statusResponseCode = statusResponseRaw.getResponseCode();
    const statusResponseText = statusResponseRaw.getContentText();

    Logger.log('Video status response code=' + statusResponseCode + ' body=' + statusResponseText);

    if (statusResponseCode >= 400) {
      throw new Error('Failed to poll video status: ' + statusResponseText);
    }

    const statusPayload = JSON.parse(statusResponseText);
    const jobStatus = statusPayload.jobStatus || statusPayload;
    const jobState = jobStatus.state || '';

    Logger.log('Video processing state: ' + jobState + ' (' + (jobStatus.progress || 0) + '%)');

    if (jobStatus.blob) {
      processedBlob = jobStatus.blob;
      if (!processedBlob.$type) {
        processedBlob.$type = 'blob';
      }
      Logger.log('Video processing complete.');
      return { blob: processedBlob };
    }

    if (jobState === 'JOB_STATE_FAILED') {
      throw new Error('Video processing failed: ' + (jobStatus.error || statusResponseText));
    }

    retries++;
  }

  throw new Error('Video processing timed out.');
}


function createThumb(imageUrl) {
  const imageData = uploadForImageLink(imageUrl);
  if (!imageData) {
    Logger.log('Could not create thumbnail; uploadForImageLink returned null for imageUrl: ' + imageUrl);
    return undefined;
  }

  // The Bluesky API expects the entire blob object, not just cid and mimeType
  return imageData["blob"];
}


function createRecord(text, facets, embed) { // Simplified parameters
  var record = {
    'text': text,
    'createdAt': (new Date()).toISOString(),
  };

  if (embed) {
    record['embed'] = embed;
  }
  
  if (facets.length > 0) {
    record['facets'] = facets;
  }

  return record;
}


function createImageRecord(text, altText, imageData, linkUrl, urlLocStart, urlLocEnd) {
  let recordText = text;
  let facets = [];

  if (linkUrl && linkUrl.trim() !== '' && urlLocStart !== -1) {
    let byteStart = getByteLength(recordText.substring(0, urlLocStart));
    let byteEnd = getByteLength(recordText.substring(0, urlLocEnd));

    facets.push({
      'index': {
        'byteStart': byteStart,
        'byteEnd': byteEnd
      },
      'features': [
        {
          '$type': 'app.bsky.richtext.facet#link',
          'uri': linkUrl
        }
      ]
    });
  }

  var record = {
    'text': recordText,
    'createdAt': (new Date()).toISOString(),
    'embed': {
      '$type': 'app.bsky.embed.images',
      'images': [{
        'alt': altText,
        'image': imageData.blob,
        'aspectRatio': {
            'width': 1200,
            'height': 675
        }
      }]
    }
  };
  
  if (facets.length > 0) {
    record['facets'] = facets;
  }

  return record;
}



function post(record, root, parent) {
  const loadedData = loadData();
  const accessJwt = loadedData.accessJwt;
  const did = loadedData.did;
  const { pdsEndpoint } = getPdsInfo(loadedData);

  const url = pdsEndpoint + '/xrpc/com.atproto.repo.createRecord';

  if (root && parent) {
    record.reply = {};
    record.reply.root = root
    record.reply.parent = parent
  }  

  if (!record['$type']) {
    record['$type'] = 'app.bsky.feed.post';
  }

  Logger.log(record)

  const data = {
    'repo': did,
    'collection': 'app.bsky.feed.post',
    'record': record
  };

  const options = {
    'method': 'post',
    'headers': {
      'Authorization': 'Bearer ' + accessJwt,
      'Content-Type': 'application/json; charset=UTF-8'
    },
    'payload': JSON.stringify(data),
    'muteHttpExceptions': true // Ensure this is always true for robust error handling
  };


  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    Logger.log('post response code=' + responseCode + ', body=' + responseText);

    if (responseCode >= 400) {
      Logger.log(`Error posting to Bluesky. Status: ${responseCode}. Response: ${responseText}`);
      return [null, null, null];
    }

    responseParsed = JSON.parse(responseText);
    var uri = responseParsed['uri'];
    var cid = responseParsed['cid'];

    postIdentifier = uri.substring(uri.lastIndexOf('/') + 1);

    blueskyLink = 'https://bsky.app/profile/didtherockieslose.bsky.social/post/' + postIdentifier;
    Logger.log("Bluesky post URL: " + blueskyLink);
    return [blueskyLink, uri, cid];
  } catch (error) {
    Logger.log('Error calling post API: ' + error.toString());
    return ['Error = ' + error.toString(), null, null];
  }
}

function testResponseParse () {

  //let uriStub = JSON.parse(response.getContentText())['uri']
  uriStub = "at://did:plc:ayzj7c2kut7sck73jpavn77g/app.bsky.feed.post/3lewooyh5wi25"
  postIdentifier = uriStub.substring(uriStub.lastIndexOf('/') + 1)
  //Logger.log(postIdentifier)

  blueskyLink = 'https://bsky.app/profile/boulderprogressives.org/post/' + postIdentifier

}


function postBluesky(postText, root, parent) {
  Logger.log('Start postBluesky (main entry point)');
  Logger.log('Original postText: ' + postText);
  
  let extractedLinkUrl = '';
  let urlLocStart = -1;
  let urlLocEnd = -1;
  let facets = [];
  let embed = undefined;

  // 1. Extract URL from postText and create URL facet if present
  urlLocStart = postText.search(/https?:\/\//); 
  if (urlLocStart !== -1) {
    var potentialUrlString = postText.substring(urlLocStart);
    var firstWhitespaceIndex = potentialUrlString.search(/[\s\n\r]/);

    extractedLinkUrl = (firstWhitespaceIndex === -1) ? potentialUrlString.trim() : potentialUrlString.substring(0, firstWhitespaceIndex).trim();
    urlLocEnd = urlLocStart + extractedLinkUrl.length;

    // Create URL facet
    let byteStart = getByteLength(postText.substring(0, urlLocStart));
    let byteEnd = getByteLength(postText.substring(0, urlLocEnd));
    facets.push({
      'index': {
        'byteStart': byteStart,
        'byteEnd': byteEnd
      },
      'features': [
        {
          '$type': 'app.bsky.richtext.facet#link',
          'uri': extractedLinkUrl
        }
      ]
    });

    // 2. Attempt to create an embed for the extracted URL
    let urlForEmbed = extractedLinkUrl;
    let titleForEmbed = '';
    let descriptionForEmbed = '';
    let thumbForEmbed = undefined;

    // Check for feed embed first
    if (extractedLinkUrl.search('/feed/') != -1) {
      let feedGenerator = getFeedGenerator(extractedLinkUrl);
      if (feedGenerator) {
        embed = {
          '$type': 'app.bsky.embed.record',
          'record': {
            'uri': feedGenerator.view.uri,
            'cid': feedGenerator.view.cid
          }
        };
      }
    } else { // If not a feed embed, try for an external link embed
      const urlInfo = getUrlInfo(urlForEmbed);
      if (urlInfo) {
        thumbForEmbed = createThumb(urlInfo.imageUrl);
        if (thumbForEmbed) { // Only create external embed if thumbnail is successfully created
          titleForEmbed = urlInfo.title || '';
          descriptionForEmbed = urlInfo.description || '';
          embed = {
            '$type': 'app.bsky.embed.external',
            'external': {
              'uri': urlForEmbed,
              'title': titleForEmbed,
              'description': descriptionForEmbed,
              'thumb': thumbForEmbed
            }
          };
        } else {
          Logger.log('Could not create thumbnail for ' + urlForEmbed + '. Proceeding without external embed.');
        }
      } else {
        Logger.log('getUrlInfo failed for ' + urlForEmbed + '. Proceeding without external embed.');
      }
    }
  } else {
    // If no URL was extracted from the text, it's a text-only post.
    // No embed will be created in this case.
    Logger.log('No URL found in post text. Creating text-only post.');
  }

  // 3. Add hashtag facet if present (always search in the full original text)
  var tagLocStart = postText.search('#');
  if (tagLocStart > -1) {
    var tagEndIndex = postText.substring(tagLocStart).search(/[\s\n\r]/);
    var tagContent = (tagEndIndex === -1) ? postText.substring(tagLocStart) : postText.substring(tagLocStart, tagLocStart + tagEndIndex);
    
    let tagByteStart = getByteLength(postText.substring(0, tagLocStart));
    let tagByteEnd = getByteLength(postText.substring(0, tagLocStart + tagContent.length));

    facets.push({
      'index': {
        'byteStart': tagByteStart,
        'byteEnd': tagByteEnd
      },
      'features': [
        {
          $type: 'app.bsky.richtext.facet#tag',
          tag: tagContent.replace(/^#/, ''),
        }
      ]
    });
  }

  // 4. Create the record
  const record = createRecord(postText, facets, embed);

  // 5. Post the record
  let [blueskyLink, uri, cid] = post(record, root, parent);
  return [blueskyLink, uri, cid];
}


function uploadImage(imageUrl) {
  const loadedData = loadData();
  const accessJwt = loadedData.accessJwt;
  var blob = getImage(imageUrl);
  
  if (!blob) {
    Logger.log('uploadImage: Could not get image blob from URL: ' + imageUrl);
    return null;
  }

  const options = {
    'method': 'post',
    'headers': {
      'Authorization': 'Bearer ' + accessJwt,
      'Content-Type': blob.getContentType()
    },
    'payload': blob.getBytes(),
    'muteHttpExceptions': true
  };

  const url = 'https://bsky.social/xrpc/com.atproto.repo.uploadBlob';
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode >= 400) {
    Logger.log(`Error uploading image blob in uploadImage. Status: ${responseCode}. Response: ${responseText}`);
    return null;
  }

  return JSON.parse(responseText);
}

function getImage(imageUrl) {
  try {
    var blob = UrlFetchApp.fetch(imageUrl).getBlob();
  } catch (error) {
    Logger.log('getImage: Error fetching image from URL: ' + imageUrl);
    Logger.log(error);
    var blob = null;
  }
  return blob;
}
