/// Number of items (albums, tracks) per page for Spotify requests
pub(crate) const ITEMS_PER_PAGE: usize = 50;

// How many tracks to pick from an album at once to save time
// Picking one track per album will require downloading a lot of them
pub(crate) const MIN_TRACKS_PER_ALBUM: usize = 3;

/// How many tracks should be included in the playlist we are building
pub(crate) const TARGET_PLAYLIST_SIZE: usize = 10;

pub(crate) const ID_PREFIX_ALBUM: &str = "spotify:album:";
pub(crate) const ID_PREFIX_PLAYLIST: &str = "spotify:playlist:";
pub(crate) const ID_PREFIX_TRACK: &str = "spotify:track:";

/// Contains a list of GraphQL operations used in requests to Spotify.
/// Use these values for `operationName` query string param.
pub(crate) mod operations {
    pub const ALBUMS_PLAYLISTS: &str = "libraryV3";
    pub const ALBUM_TRACKS: &str = "getAlbum";
}

/// Spotify uses Apollo GraphQL with persistent queries.
/// Every operation has a particular query that is not known to the client, but is identified by a hash.
/// The list of hashes is stored in this module. The hashes may change if Spotify changes the queries.
/// All clients share the same set of hashes as the are specific to the query, not the client.
/// A good explanation is in this repo https://github.com/apollographql/apollo-link-persisted-queries#protocol
pub(crate) mod persistent_queries {
    pub const GET_ALBUM: &str = "46ae954ef2d2fe7732b4b2b4022157b2e18b7ea84f70591ceb164e4de1b5d5d3";
    pub const LIBRARY_V3: &str = "17d801ba80f3a3d7405966641818c334fe32158f97e9e8b38f1a92f764345df9";
}

/// Logs output into browser console. It is not the same console as for the web page because the extension runs separately.
/// Look for the service worker console.
macro_rules!  log {
    ( $( $t:tt )* ) => {
        web_sys::console::log_1(&format!( $( $t )* ).into())
    }
}
pub(crate) use log;
