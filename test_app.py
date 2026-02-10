from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        # 1. Configure Mobile Viewport (iPhone 13-ish)
        iphone_13 = p.devices['iPhone 13']
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(**iphone_13)
        page = context.new_page()
        
        # Setup dialog handler
        page.on("dialog", lambda dialog: dialog.accept())
        
        print("Navigating to app (Mobile Viewport)...")
        page.goto('http://localhost:5173')
        page.wait_for_load_state('networkidle')
        
        # --- PANTRY CHECK RITUAL TEST ---
        print("\n--- Testing Pantry Check Ritual ---")
        print("Navigating to Pantry...")
        page.get_by_role("button", name="Pantry").click()
        page.wait_for_timeout(500)
        
        print("Starting Pantry Check...")
        # Check if button exists (it should)
        if page.get_by_role("button", name="Start Check ➔").is_visible():
            page.get_by_role("button", name="Start Check ➔").click()
            page.wait_for_timeout(500)
            
            # Verify we are in the session
            if page.get_by_text("Pantry Check").is_visible():
                print("SUCCESS: Pantry Check session started.")
                
                # Verify first card (Chicken Breast is index 0 in default items)
                # Note: SwipeDeck renders items in order.
                first_item_text = "Chicken Breast" # From InventoryContext
                if page.get_by_text(first_item_text).is_visible():
                    print(f"   Found first item: {first_item_text}")
                    
                    # Swipe Right (Drag simulation)
                    print("   Swiping Right (Need it)...")
                    card = page.get_by_text(first_item_text).first
                    # Get bounding box to drag from center
                    box = card.bounding_box()
                    if box:
                        start_x = box['x'] + box['width'] / 2
                        start_y = box['y'] + box['height'] / 2
                        
                        page.mouse.move(start_x, start_y)
                        page.mouse.down()
                        # Drag to right
                        page.mouse.move(start_x + 300, start_y, steps=10)
                        page.mouse.up()
                        
                        # Wait for animation
                        page.wait_for_timeout(1000)
                        
                        # Verify card is gone
                        if not page.get_by_text(first_item_text).is_visible():
                            print(f"SUCCESS: Swiped '{first_item_text}' away.")
                        else:
                            print(f"FAILURE: '{first_item_text}' still visible after swipe.")
                            
                        # Verify we are on next card (Rice)
                        if page.get_by_text("Rice").is_visible():
                             print("SUCCESS: Next card 'Rice' is visible.")
                    else:
                        print("FAILURE: Could not get bounding box for card.")
                else:
                     print(f"FAILURE: First item '{first_item_text}' not found.")
                     
            else:
                print("FAILURE: Pantry Check title not found.")
        else:
            print("FAILURE: Start Check button not found.")

        browser.close()
        print("\nAdvanced test complete.")

if __name__ == "__main__":
    run()
