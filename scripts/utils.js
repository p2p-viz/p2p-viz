function randomColor() {
  var letters = "0123456789ABCDEF";
  var color = "#";

  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }

  return color;
}

function fallbackCopyTextToClipboard(text) {
  var textArea = document.createElement("textarea");
  textArea.value = text;
  
  // Avoid scrolling to bottom
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    var successful = document.execCommand('copy');
    var msg = successful ? 'successful' : 'unsuccessful';
    console.log('Fallback: Copying text command was ' + msg);
  } catch (err) {
    console.error('Fallback: Oops, unable to copy', err);
  }

  document.body.removeChild(textArea);
}

function copyTextToClipboard(text) {
  if (!navigator.clipboard) {
    fallbackCopyTextToClipboard(text);
    return;
  }
  navigator.clipboard.writeText(text).then(function() {
    console.log('Async: Copying to clipboard was successful!');
  }, function(err) {
    console.error('Async: Could not copy text: ', err);
  });
}

function utilsUpdateActivePeersList(containerName)
{
    document.getElementById("peerList").innerHTML = ""

        for(const pid in peerIdsToAlias) {
            document.getElementById("peerList").innerHTML += `<li class="activepeer tooltip"><b>${ peerIdsToAlias[pid] }</b><button class="tooltiptext" onclick="copyTextToClipboard('${ pid }')">${ pid }</button></li>`;
        }
        
        let items = document.querySelectorAll('.activepeer');
        for (let i = 0; i < items.length; i++){
	          items[i].style.background = randomColor();
	    }
}

function utilsGetByValue(map, searchValue) 
{
	for (let key in map)
	{
		if (map[key] === searchValue) return key;
	}
	return  undefined;
}

async function utilsGetPeers() {
    
    const res = await fetch("https://ice-server.karmakarmeghdip.repl.co/activePeers");
    const jsondata = await res.json();
    return jsondata;
}

function utilsSyntaxHighlight(json) {
    if (typeof json != 'string') {
         json = JSON.stringify(json, undefined, 2);
    }
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        var cls = 'number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
            } else {
                cls = 'string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'boolean';
        } else if (/null/.test(match)) {
            cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}