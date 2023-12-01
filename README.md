# Chrome extension for generating a random playlist from your library tracks, albums and playlists 

This extension builds a Spotify playlist out of random tracks found in _My Library_ to let you listen to everything you have in there on shuffle.  

It picks tracks from Liked Songs, Liked Albums and Liked Playlists.

* Install the extension
* Log into Spotify
* Create a new playlist
* Click on the extension button in the toolbar menu to add tracks

Once the extension is running, you can close the Spotify tab or navigate away from the playlist. It will continue creating a shuffled sample of your library in the background. 

The extension popup window receives updates from the background script working on the task. Keep it open to watch the progress. More information is logged into the browser console by WASM and JS scripts.

### Screenshots

Activate the extension

![extension menu](media/screen-chrome-ext-menu.png)

It will only work on a page with a Spotify playlist

![spotify homepage](media/screen-spotify-homepage.png)

Create a new playlist or open a playlist you created earlier and already added tracks to.
New tracks are added at the end of the playlist.

![target playlist](media/screen-spotify-playlist.png)

A simple progress log is displayed while the tracks are being added.
Keep the popup window open if you want to watch the updates.

The little badge with `...` over the toolbar button appears while the background script is running. 

![progress log](media/screen-spotify-progress-log.png)

Refresh the page to see newly added tracks.

![playlist done](media/screen-spotify-playlist-done.png)

### Feedback and bug reports

This project is under active development. Feel free to [open an issue](https://github.com/rimutaka/spotify-playlist-builder/issues) if you run into problems or have any kind of feedback.

### Privacy policy

This extension does not collect any information about the user or user activities.  
The only site it communicates with is Spotify.

## Under the hood

The plugin intercepts the session token from Spotify requests and impersonates the Spotify client to:
* read the contents of the user library
* add random tracks to the current playlist

It does not transmit any of your data to any third party. All requests go to Spotify.

Most of the work is done by [a WASM module](wasm_mod) built in Rust.

## Attributions

The extension stub was taken from https://github.com/theberrigan/rust-wasm-chrome-ext by https://github.com/theberrigan.

The toolbar icon is based on a vector image by https://rawpixel.com.