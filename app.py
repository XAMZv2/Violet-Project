from flask import Flask, render_template, request, jsonify
from ytmusicapi import YTMusic
import re
import yt_dlp
import os
app = Flask(__name__)

# Public search/catalog metadata only. This is not an audio-streaming API.
ytmusic = YTMusic()


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/search")
def search_music():
    query = (request.args.get("q") or "").strip()
    if not query:
        return jsonify({"results": []})
    if len(query) > 160:
        return jsonify({"error": "Query terlalu panjang."}), 400

    try:
        raw_results = ytmusic.search(query, filter="songs", limit=12)
        results = []
        for item in raw_results:
            video_id = item.get("videoId")
            if not video_id:
                continue
            thumbnails = item.get("thumbnails") or []
            results.append({
                "videoId": video_id,
                "title": item.get("title", "Unknown title"),
                "artists": ", ".join(
                    artist.get("name", "") for artist in item.get("artists", [])
                    if artist.get("name")
                ) or "Unknown artist",
                "album": (item.get("album") or {}).get("name", ""),
                "duration": item.get("duration", ""),
                "thumbnail": thumbnails[-1].get("url", "") if thumbnails else "",
                "url": f"https://music.youtube.com/watch?v={video_id}",
            })
        return jsonify({"results": results})
    except Exception:
        app.logger.exception("ytmusicapi search failed")
        return jsonify({
            "error": "Pencarian musik gagal. Coba lagi beberapa saat lagi."
        }), 502


@app.get("/api/stream/<video_id>")
def stream_music(video_id):
    # Extract a short-lived audio URL for HTMLAudioElement. This is best-effort:
    # YouTube can change formats, block extraction, or expire URLs.
    if not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
        return jsonify({"error": "ID lagu tidak valid."}), 400
    try:
        target = f"https://www.youtube.com/watch?v={video_id}"
        options = {
            "format": "bestaudio[protocol^=http]/bestaudio/best",
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "skip_download": True,
            "extractor_args": {"youtube": {"player_client": ["default"]}},
        }
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(target, download=False)
        stream_url = info.get("url")
        if not stream_url and info.get("requested_formats"):
            audio_formats = [f for f in info["requested_formats"] if f.get("acodec") not in (None, "none")]
            stream_url = audio_formats[0].get("url") if audio_formats else None
        if not stream_url:
            return jsonify({"error": "Stream audio tidak tersedia untuk lagu ini."}), 502
        return jsonify({"url": stream_url, "ext": info.get("ext", "")})
    except Exception:
        app.logger.exception("yt-dlp stream extraction failed")
        return jsonify({"error": "Audio tidak bisa diambil saat ini. YouTube mungkin membatasi stream ini; coba lagu lain."}), 502


if __name__ == "__main__":
    # Local development only. For LAN testing, host=0.0.0.0 lets your phone
    # reach the app over the same Wi-Fi; allow Python through Windows Firewall.
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=True)
