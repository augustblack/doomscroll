# media/

Put your own images, video, and audio in this folder, then refer to them from
`config.js` as `"media/yourfile.mp4"`.

## The files in here now are placeholders

They ship with the demo so the project works the moment you open it. **Delete
them once you have your own material** — there is no reason to upload them.

They were generated with ffmpeg, not filmed, so they are free to use, throw
away, or regenerate:

```sh
# video
ffmpeg -f lavfi -i "testsrc2=size=1280x720:rate=30:duration=6" \
  -vf "hue=s=0.4,eq=contrast=1.2" -c:v libx264 -pix_fmt yuv420p -g 15 -crf 30 -an pattern.mp4

ffmpeg -f lavfi -i "gradients=size=1280x720:rate=30:duration=8:speed=0.05:c0=0x0a0a2e:c1=0xff2b5e" \
  -c:v libx264 -pix_fmt yuv420p -g 15 -crf 30 -an gradient.mp4

# -g 10 puts a keyframe every 10 frames, which is what makes scrubbing smooth
ffmpeg -f lavfi -i "mandelbrot=size=1280x720:rate=30" -t 8 \
  -c:v libx264 -pix_fmt yuv420p -g 10 -crf 30 -an zoom.mp4

# stills
ffmpeg -f lavfi -i "nullsrc=size=600x600,geq=random(1)*255:128:128,format=gray" -frames:v 1 grain.png
ffmpeg -f lavfi -i "color=c=black:s=1200x1200,geq=r='255*gt(mod(X+Y,120),60)':g='40':b='90*sin(X/60)'" -frames:v 1 stripes.png

# audio
ffmpeg -f lavfi -i "sine=frequency=55:duration=20,aeval='val(0)*0.6+0.2*sin(2*PI*82.4*t)'" \
  -af "tremolo=f=0.3:d=0.5,aformat=channel_layouts=stereo" -c:a libmp3lame -b:a 96k drone.mp3

ffmpeg -f lavfi -i "anoisesrc=duration=10:color=brown:amplitude=0.5" \
  -af "aformat=channel_layouts=stereo" -c:a libmp3lame -b:a 96k noise.mp3
```

## Preparing your own media

See the "Media diet" section of the main `README.md`. The short version:

```sh
# shrink any video to a web-friendly 1080p H.264
ffmpeg -i big.mov -vf "scale=-2:1080" -c:v libx264 -crf 26 -preset slow \
  -pix_fmt yuv420p -c:a aac -b:a 128k small.mp4

# a clip you intend to scrub needs frequent keyframes
ffmpeg -i big.mov -vf "scale=-2:1080" -c:v libx264 -crf 26 -g 10 \
  -pix_fmt yuv420p -an scrubbable.mp4
```

Keep filenames lowercase with no spaces — `my clip.mp4` will break on some
webservers, `my-clip.mp4` will not.
