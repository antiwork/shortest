import { shortest } from "@antiwork/shortest";

shortest("Search for 'cute puppies' on YouTube and play the first video");

shortest("Watch a YouTube video and change playback settings", {
  videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  settings: {
    quality: "1080p",
    playbackSpeed: "1.5x",
    subtitles: "on",
  },
});

shortest("Visit a YouTube channel and verify latest content", {
  channelName: "TED",
  sortBy: "newest",
});
