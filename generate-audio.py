import json
import os
import asyncio
import edge_tts

INPUT_JSON = "audio-script.json"
VOICE = "en-US-AvaNeural"  # Clear, natural American English voice
CONCURRENT_LIMIT = 10      # Generates 10 files at a time (~3 mins total)

async def generate_audio(semaphore, text, output_path):
    # Skip if the file already exists (useful if you ever need to resume)
    if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
        return

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    async with semaphore:
        for attempt in range(3):  # Retry up to 3 times if network hiccups
            try:
                communicate = edge_tts.Communicate(text, VOICE)
                await communicate.save(output_path)
                print(f"Saved: {output_path}")
                break
            except Exception as e:
                if attempt == 2:
                    print(f"Failed to generate {output_path}: {e}")
                else:
                    await asyncio.sleep(1)

async def main():
    with open(INPUT_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    semaphore = asyncio.Semaphore(CONCURRENT_LIMIT)
    tasks = []

    for item in data:
        # Uses your phonetic *_tts fields and exact *_file paths
        tasks.append(generate_audio(semaphore, item["word_tts"], item["word_file"]))
        tasks.append(generate_audio(semaphore, item["definition_tts"], item["definition_file"]))
        tasks.append(generate_audio(semaphore, item["sentence_tts"], item["sentence_file"]))

    print(f"Generating {len(tasks)} audio files...")
    await asyncio.gather(*tasks)
    print("Done! All 1,350 files are in the 'audio/' folder.")

if __name__ == "__main__":
    asyncio.run(main())