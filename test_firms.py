from backend.firms_service import fetch_recent_observations

try:
    print("Connecting to NASA FIRMS...")

    observations = fetch_recent_observations(day_range=1)

    print(f"\nConnection successful!")
    print(f"Observations received: {len(observations)}")

    if observations:
        print("\nFirst observation:")
        print(observations[0])
    else:
        print("No observations returned for this date and area.")

except Exception as e:
    print("FIRMS connection failed:")
    print(e)