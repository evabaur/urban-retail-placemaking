import { save, one, run, passwordHash, uid, runtime } from "./server";
export async function seedDemo() {
  const course = "demo";
  if (await one("SELECT id FROM records WHERE id='demo-ready'")) {
    await run(
      "UPDATE records SET data=replace(replace(data,'2026-11-6T','2026-11-06T'),'2026-11-9T','2026-11-09T') WHERE course='demo' AND kind IN ('event','assignment')",
    );
    await run(
      "UPDATE records SET data=json_set(data,'$.assignmentType','vpa') WHERE course='demo' AND kind='assignment'",
    );
    return;
  }
  const groups = ["Brand A", "Brand B", "Brand C"];
  const names = [
    "Alex Morgan",
    "Sam Rivera",
    "Jordan Lee",
    "Taylor Brooks",
    "Casey Ellis",
    "Jamie Park",
    "Riley Chen",
    "Avery Patel",
    "Drew Wilson",
  ];
  // Fictional identities and observations only. Never represent these as actual student evidence.
  const observations = [
    "The notebook display paired an unfinished sketch with a finished design. Visitors stopped to compare the two before touching the products. This made the notebook feel like a tool for a future self rather than a commodity. A useful next step would be to count how many visitors try the pens after seeing the sketch.",
    "The entrance opened into a quiet transitional space. I watched three people slow down as they moved from the street into the display area. The change in light and acoustic texture seemed to invite attention. This is a hypothesis from a brief observation, not evidence of a general causal effect.",
    "Repairs and worn products were displayed beside new stock. A staff member described the previous life of one material. The juxtaposition made durability tangible. I would compare visitor questions at this display with questions at the price-led shelf to test whether it changes the conversation.",
  ];
  for (let g = 0; g < groups.length; g++)
    await save("group", course, "demo-group-" + g, { name: groups[g], max: 6 });
  for (let i = 0; i < names.length; i++)
    await run(
      "INSERT OR IGNORE INTO users(id,uni,name,role,course,group_id,password,must_change,disabled) VALUES(?,?,?,?,?,?,?,0,0)",
      "demo-" + i,
      "demo" + (i + 1),
      names[i],
      "student",
      course,
      "demo-group-" + (i % 3),
      await passwordHash(uid() + uid()),
    );
  for (let t = 0; t < 3; t++) {
    const a = "demo-assignment-" + t;
    await save("assignment", course, a, {
      assignmentType: "vpa",
      title: [
        "Trek 1 · Identify an experience maker",
        "Trek 2 · Meaning making",
        "Trek 3 · Reading the space",
      ][t],
      due:
        "2026-11-" +
        String([9, 16, 23][t]).padStart(2, "0") +
        "T23:59:00-05:00",
      rubric: [
        { id: "insight", title: "Value of the insight", points: 3 },
        { id: "evidence", title: "Evidence and observation", points: 3 },
        { id: "connection", title: "Connection to course ideas", points: 3 },
      ],
      demoRubric: true,
    });
    for (let i = 0; i < names.length; i++) {
      const s = `demo-sub-${t}-${i}`,
        author = "demo-" + i;
      await save(
        "submission",
        course,
        s,
        {
          text: observations[(i + t) % 3],
          filename: "Field observation.txt",
          assignment: a,
        },
        author,
        null,
        a,
      );
      const reviewer = "demo-" + ((i + 8) % 9);
      const allocation = `allocation:${a}:${reviewer}:${s}`;
      await save(
        "allocation",
        course,
        allocation,
        { assignment: a, status: "pending" },
        reviewer,
        null,
        s,
      );
      if (t === 0 && reviewer !== "demo-0")
        await save(
          "review",
          course,
          "review:" + allocation,
          {
            assignment: a,
            scores: { insight: 2, evidence: 3, connection: 2 },
            comments: {
              insight:
                "Clear interpretation. Consider one competing explanation.",
              evidence: "Specific observations anchor the argument.",
              connection: "Make the link to the framework explicit.",
            },
            comment:
              "The observation is strongest when it separates what you saw from what you inferred.",
            total: 7,
          },
          reviewer,
          null,
          allocation,
        );
    }
  }
  for (let i = 0; i < 3; i++) {
    const e = "demo-trek-" + i;
    await save("event", course, e, {
      title: ["Madison Avenue", "Meatpacking District", "SoHo"][i],
      date: `2026-11-${String([6, 13, 20][i]).padStart(2, "0")}T09:00:00-05:00`,
      kind: "trek",
      location: "New York City",
      note: "Demonstration schedule; live itinerary is maintained by the teaching team.",
    });
    if (i === 0)
      for (let j = 0; j < 9; j++)
        await save(
          "attendance",
          course,
          `attendance:${e}:demo-${j}`,
          { status: j === 4 ? "excused" : "present", markedBy: "Demo staff" },
          "demo-" + j,
          null,
          e,
        );
  }
  for (let i = 0; i < 2; i++)
    await save("round", course, "demo-round-" + i, {
      title: i ? "Final team assessment" : "Midterm team assessment",
      open: false,
      closes: null,
    });
  for (let i = 0; i < 3; i++)
    await save("milestone", course, "demo-milestone-" + i, {
      title: [
        "Client meeting preparation",
        "Work-in-progress presentation",
        "Final recommendations",
      ][i],
      due: null,
    });
  const key = "demo/demo-group-0/welcome";
  await runtime().BUCKET.put(
    key,
    "DEMONSTRATION FILE\nTeam preparation notes\nQuestions: Who visits? What do they notice? What do they do next?",
  );
  await save(
    "file",
    course,
    "demo-welcome-file",
    {
      key,
      filename: "Team preparation.txt",
      size: 134,
      uploader: names[3],
      milestone: "demo-milestone-0",
    },
    "demo-3",
    "demo-group-0",
  );
  await save("meta", course, "demo-ready", { ready: true });
}
