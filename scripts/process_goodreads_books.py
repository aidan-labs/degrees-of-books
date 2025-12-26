# process_goodreads_books.py

import json
import os

def remove_duplicate(items):
    """
    Remove duplicates from a list while keeping the original order.
    """
    seen = set()
    result = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result

# Step 1: Clean the dataset

books_by_title = {}

with open("goodreads_books.json", "r", encoding="utf-8") as f:
    for line in f:
        book = json.loads(line)

        title = book.get("title", "")
        if not title:
            continue

        book_id = book.get("book_id", "")
        url = book.get("url", "")
        image_url = book.get("image_url", "")
        similar_books = book.get("similar_books", [])

        if title not in books_by_title:
            # First occurrence becomes the main book
            books_by_title[title] = {
                "book_id": book_id,
                "title": title,
                "url": url,
                "image_url": image_url,
                "similar_books": list(similar_books)
            }
        else:
            existing = books_by_title[title]

            if not existing["image_url"] and image_url:
                existing["image_url"] = image_url

            # Merge similar_books
            existing["similar_books"].extend(similar_books)

filtered_books = []

for book in books_by_title.values():
    # Remove duplicates from similar_books
    book["similar_books"] = remove_duplicate(book["similar_books"])

    # Skip books with no similar_books
    if not book["similar_books"]:
        continue

    filtered_books.append(book)

print(f"Total books after filtering: {len(filtered_books)}")
print(f"Books removed (no similar_books): {len(books_by_title) - len(filtered_books)}")

# Step 2: Split into smaller JSON files

output_folder = "data"
os.makedirs(output_folder, exist_ok=True)

books_per_chunk = 50000
chunk_index = 1
chunk_books = []

for book in filtered_books:
    chunk_books.append(book)
    if len(chunk_books) >= books_per_chunk:
        output_file = os.path.join(output_folder, f"graph-{chunk_index:03}.json")
        with open(output_file, "w", encoding="utf-8") as out_f:
            json.dump({"books": chunk_books}, out_f, indent=2)
        print(f"Wrote {output_file} ({len(chunk_books)} books)")
        chunk_index += 1
        chunk_books = []

# Write remaining books
if chunk_books:
    output_file = os.path.join(output_folder, f"graph-{chunk_index:03}.json")
    with open(output_file, "w", encoding="utf-8") as out_f:
        json.dump({"books": chunk_books}, out_f, indent=2)
    print(f"Wrote {output_file} ({len(chunk_books)} books)")

print("Done!")
