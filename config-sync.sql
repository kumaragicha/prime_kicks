-- Config data sync: Dimensions, DimensionCombinations, CourierConfig
-- Generated from the source (local) DB. Idempotent; safe to run on prod.
-- Everything is keyed BY ID — prod becomes an exact copy (ids included).
BEGIN;

-- 1) Dimensions (upsert by id)
INSERT INTO "Dimension" (id, name, weight, length, width, height, "isActive", "createdAt", "updatedAt")
VALUES ('cmslas9ov001b3q27605omrtr', 'Extra Large (Multiple shoes)', 5, 40, 30, 20, true, now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, weight = EXCLUDED.weight, length = EXCLUDED.length,
  width = EXCLUDED.width, height = EXCLUDED.height, "isActive" = EXCLUDED."isActive",
  "updatedAt" = now();
INSERT INTO "Dimension" (id, name, weight, length, width, height, "isActive", "createdAt", "updatedAt")
VALUES ('cmsie8aqj00023qq9gnabt5nr', 'Large (Airforce,Speed cat))', 1.7, 34, 12, 21, true, now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, weight = EXCLUDED.weight, length = EXCLUDED.length,
  width = EXCLUDED.width, height = EXCLUDED.height, "isActive" = EXCLUDED."isActive",
  "updatedAt" = now();
INSERT INTO "Dimension" (id, name, weight, length, width, height, "isActive", "createdAt", "updatedAt")
VALUES ('cmsig3ei7000j3qnesdtowdg7', 'Medium (Bellet)', 1, 20, 10, 10, true, now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, weight = EXCLUDED.weight, length = EXCLUDED.length,
  width = EXCLUDED.width, height = EXCLUDED.height, "isActive" = EXCLUDED."isActive",
  "updatedAt" = now();
INSERT INTO "Dimension" (id, name, weight, length, width, height, "isActive", "createdAt", "updatedAt")
VALUES ('cmslas9or00183q27cb6e4478', 'Small (Converse, Vans, Crocs)', 0.5, 24, 16, 8, true, now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, weight = EXCLUDED.weight, length = EXCLUDED.length,
  width = EXCLUDED.width, height = EXCLUDED.height, "isActive" = EXCLUDED."isActive",
  "updatedAt" = now();

-- 2) DimensionCombinations + items (full replace; references by id)
DELETE FROM "DimensionCombination";
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p3o00053qeroauck9ye', 'Large × 1 + Medium × 1', 5, 'cmslas9ov001b3q27605omrtr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p3o00073qerpvmbw520', 'cmsms1p3o00053qeroauck9ye', 'cmsie8aqj00023qq9gnabt5nr', 1);
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p3o00083qerc414naob', 'cmsms1p3o00053qeroauck9ye', 'cmsig3ei7000j3qnesdtowdg7', 1);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p40001b3qer5u3n7lje', 'Large × 1 + Medium × 1 + Small × 1', 5, 'cmslas9ov001b3q27605omrtr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p40001d3qer5ma4vwp3', 'cmsms1p40001b3qer5u3n7lje', 'cmsie8aqj00023qq9gnabt5nr', 1);
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p40001e3qer0z97z37s', 'cmsms1p40001b3qer5u3n7lje', 'cmsig3ei7000j3qnesdtowdg7', 1);
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p40001f3qerfwbdvw42', 'cmsms1p40001b3qer5u3n7lje', 'cmslas9or00183q27cb6e4478', 1);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p4l00393qer68rjcwyc', 'Large × 1 + Medium × 1 + Small × 2', 5, 'cmslas9ov001b3q27605omrtr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4l003b3qermrqnezup', 'cmsms1p4l00393qer68rjcwyc', 'cmsie8aqj00023qq9gnabt5nr', 1);
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4l003c3qerkso8lwap', 'cmsms1p4l00393qer68rjcwyc', 'cmsig3ei7000j3qnesdtowdg7', 1);
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4l003d3qerjzc779h3', 'cmsms1p4l00393qer68rjcwyc', 'cmslas9or00183q27cb6e4478', 2);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p3z00163qerbjk4kzu9', 'Large × 1 + Medium × 2', 5, 'cmslas9ov001b3q27605omrtr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p3z00183qermu5eq37n', 'cmsms1p3z00163qerbjk4kzu9', 'cmsie8aqj00023qq9gnabt5nr', 1);
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p3z00193qerlsrypulg', 'cmsms1p3z00163qerbjk4kzu9', 'cmsig3ei7000j3qnesdtowdg7', 2);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p4k00333qer67wwo7jc', 'Large × 1 + Medium × 2 + Small × 1', 5, 'cmslas9ov001b3q27605omrtr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4k00353qerbbkj2amg', 'cmsms1p4k00333qer67wwo7jc', 'cmsie8aqj00023qq9gnabt5nr', 1);
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4k00363qer5dejmgor', 'cmsms1p4k00333qer67wwo7jc', 'cmsig3ei7000j3qnesdtowdg7', 2);
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4k00373qeru8t234hc', 'cmsms1p4k00333qer67wwo7jc', 'cmslas9or00183q27cb6e4478', 1);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p4f002y3qerk499r8wl', 'Large × 1 + Medium × 3', 5, 'cmslas9ov001b3q27605omrtr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4f00303qerqxuob6n8', 'cmsms1p4f002y3qerk499r8wl', 'cmsie8aqj00023qq9gnabt5nr', 1);
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4f00313qerv59km4uh', 'cmsms1p4f002y3qerk499r8wl', 'cmsig3ei7000j3qnesdtowdg7', 3);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p3p000a3qeru2segv0r', 'Large × 1 + Small × 1', 5, 'cmslas9ov001b3q27605omrtr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p3p000c3qers9m29xwk', 'cmsms1p3p000a3qeru2segv0r', 'cmsie8aqj00023qq9gnabt5nr', 1);
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p3p000d3qerxcagrqzl', 'cmsms1p3p000a3qeru2segv0r', 'cmslas9or00183q27cb6e4478', 1);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p41001h3qergkd2fb5l', 'Large × 1 + Small × 2', 5, 'cmslas9ov001b3q27605omrtr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p41001j3qer7djrvd5h', 'cmsms1p41001h3qergkd2fb5l', 'cmsie8aqj00023qq9gnabt5nr', 1);
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p41001k3qer3j8j7ih1', 'cmsms1p41001h3qergkd2fb5l', 'cmslas9or00183q27cb6e4478', 2);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p4n003f3qerv5eu7z2j', 'Large × 1 + Small × 3', 5, 'cmslas9ov001b3q27605omrtr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4n003h3qern8vn0fkd', 'cmsms1p4n003f3qerv5eu7z2j', 'cmsie8aqj00023qq9gnabt5nr', 1);
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4n003i3qerfcz7yldq', 'cmsms1p4n003f3qerv5eu7z2j', 'cmslas9or00183q27cb6e4478', 3);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p3k00013qer16t5sol8', 'Large × 2', 5, 'cmslas9ov001b3q27605omrtr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p3k00033qercxk5s3vs', 'cmsms1p3k00013qer16t5sol8', 'cmsie8aqj00023qq9gnabt5nr', 2);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p3x000w3qeragzme7o8', 'Large × 2 + Medium × 1', 5, 'cmslas9ov001b3q27605omrtr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p3x000y3qerbdvynqra', 'cmsms1p3x000w3qeragzme7o8', 'cmsie8aqj00023qq9gnabt5nr', 2);
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p3x000z3qer37dhizj9', 'cmsms1p3x000w3qeragzme7o8', 'cmsig3ei7000j3qnesdtowdg7', 1);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p4c002n3qerwepzg9jq', 'Large × 2 + Medium × 1 + Small × 1', 5, 'cmslas9ov001b3q27605omrtr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4c002p3qerv4vo27nv', 'cmsms1p4c002n3qerwepzg9jq', 'cmsie8aqj00023qq9gnabt5nr', 2);
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4c002q3qergxbfxp4y', 'cmsms1p4c002n3qerwepzg9jq', 'cmsig3ei7000j3qnesdtowdg7', 1);
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4c002r3qerlpi2iueh', 'cmsms1p4c002n3qerwepzg9jq', 'cmslas9or00183q27cb6e4478', 1);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p4b002i3qer9z2fcxu6', 'Large × 2 + Medium × 2', 5, 'cmslas9ov001b3q27605omrtr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4b002k3qercd2rp7sa', 'cmsms1p4b002i3qer9z2fcxu6', 'cmsie8aqj00023qq9gnabt5nr', 2);
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4b002l3qervimwn7d2', 'cmsms1p4b002i3qer9z2fcxu6', 'cmsig3ei7000j3qnesdtowdg7', 2);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p3y00113qerd1n3jcft', 'Large × 2 + Small × 1', 5, 'cmslas9ov001b3q27605omrtr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p3y00143qer5p4dnz0m', 'cmsms1p3y00113qerd1n3jcft', 'cmslas9or00183q27cb6e4478', 1);
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p3y00133qerjkrauqr6', 'cmsms1p3y00113qerd1n3jcft', 'cmsie8aqj00023qq9gnabt5nr', 2);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p4d002t3qerz6b1gj9n', 'Large × 2 + Small × 2', 5, 'cmslas9ov001b3q27605omrtr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4d002v3qer36ucg4rz', 'cmsms1p4d002t3qerz6b1gj9n', 'cmsie8aqj00023qq9gnabt5nr', 2);
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4d002w3qerzusuqzq8', 'cmsms1p4d002t3qerz6b1gj9n', 'cmslas9or00183q27cb6e4478', 2);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p3v000s3qers1zlzzut', 'Large × 3', 5, 'cmslas9ov001b3q27605omrtr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p3v000u3qer5xruvwqq', 'cmsms1p3v000s3qers1zlzzut', 'cmsie8aqj00023qq9gnabt5nr', 3);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p4800283qerfiunfbtg', 'Large × 3 + Medium × 1', 5, 'cmslas9ov001b3q27605omrtr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p48002a3qerygiix1y8', 'cmsms1p4800283qerfiunfbtg', 'cmsie8aqj00023qq9gnabt5nr', 3);
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p48002b3qer22i9rcbf', 'cmsms1p4800283qerfiunfbtg', 'cmsig3ei7000j3qnesdtowdg7', 1);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p49002d3qer4yy00iuh', 'Large × 3 + Small × 1', 5, 'cmslas9ov001b3q27605omrtr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p49002f3qer2uq9okxn', 'cmsms1p49002d3qer4yy00iuh', 'cmsie8aqj00023qq9gnabt5nr', 3);
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p49002g3qer56vf4m6c', 'cmsms1p49002d3qer4yy00iuh', 'cmslas9or00183q27cb6e4478', 1);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p4700243qerucad5wc6', 'Large × 4', 5, 'cmslas9ov001b3q27605omrtr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4700263qer4cj6e4gh', 'cmsms1p4700243qerucad5wc6', 'cmsie8aqj00023qq9gnabt5nr', 4);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p3s000j3qerpzu7wxod', 'Medium × 1 + Small × 1', 2, 'cmsie8aqj00023qq9gnabt5nr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p3s000l3qerv42h9fho', 'cmsms1p3s000j3qerpzu7wxod', 'cmsig3ei7000j3qnesdtowdg7', 1);
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p3s000m3qerikw3fbsu', 'cmsms1p3s000j3qerpzu7wxod', 'cmslas9or00183q27cb6e4478', 1);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p44001v3qer08q9egfv', 'Medium × 1 + Small × 2', 2, 'cmsie8aqj00023qq9gnabt5nr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p44001x3qerhotnagur', 'cmsms1p44001v3qer08q9egfv', 'cmsig3ei7000j3qnesdtowdg7', 1);
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p44001y3qer7hhsa73w', 'cmsms1p44001v3qer08q9egfv', 'cmslas9or00183q27cb6e4478', 2);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p4r003y3qergid9szio', 'Medium × 1 + Small × 3', 5, 'cmslas9ov001b3q27605omrtr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4r00403qerb5ivo0pi', 'cmsms1p4r003y3qergid9szio', 'cmsig3ei7000j3qnesdtowdg7', 1);
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4r00413qer0ztp4jbb', 'cmsms1p4r003y3qergid9szio', 'cmslas9or00183q27cb6e4478', 3);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p3r000f3qermhak0zk8', 'Medium × 2', 2, 'cmsie8aqj00023qq9gnabt5nr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p3r000h3qerdmf6mm42', 'cmsms1p3r000f3qermhak0zk8', 'cmsig3ei7000j3qnesdtowdg7', 2);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p43001q3qerks4woej2', 'Medium × 2 + Small × 1', 5, 'cmslas9ov001b3q27605omrtr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p43001s3qerjwsk5pio', 'cmsms1p43001q3qerks4woej2', 'cmsig3ei7000j3qnesdtowdg7', 2);
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p43001t3qerdfqch4kv', 'cmsms1p43001q3qerks4woej2', 'cmslas9or00183q27cb6e4478', 1);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p4q003t3qersljaj6ib', 'Medium × 2 + Small × 2', 5, 'cmslas9ov001b3q27605omrtr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4q003v3qercz7mmjh8', 'cmsms1p4q003t3qersljaj6ib', 'cmsig3ei7000j3qnesdtowdg7', 2);
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4q003w3qerljem2gw6', 'cmsms1p4q003t3qersljaj6ib', 'cmslas9or00183q27cb6e4478', 2);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p42001m3qerecj8lcfm', 'Medium × 3', 5, 'cmslas9ov001b3q27605omrtr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p42001o3qerchcun3qr', 'cmsms1p42001m3qerecj8lcfm', 'cmsig3ei7000j3qnesdtowdg7', 3);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p4p003o3qeriwc63qnx', 'Medium × 3 + Small × 1', 5, 'cmslas9ov001b3q27605omrtr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4p003q3qerud5l2a99', 'cmsms1p4p003o3qeriwc63qnx', 'cmsig3ei7000j3qnesdtowdg7', 3);
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4p003r3qeriyefbocl', 'cmsms1p4p003o3qeriwc63qnx', 'cmslas9or00183q27cb6e4478', 1);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p4o003k3qeroww1vtrs', 'Medium × 4', 5, 'cmslas9ov001b3q27605omrtr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4o003m3qer0z4vmye3', 'cmsms1p4o003k3qeroww1vtrs', 'cmsig3ei7000j3qnesdtowdg7', 4);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p3u000o3qer2tjet6d4', 'Small × 2', 1, 'cmsig3ei7000j3qnesdtowdg7', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p3u000q3qerl42yg6ff', 'cmsms1p3u000o3qer2tjet6d4', 'cmslas9or00183q27cb6e4478', 2);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p4500203qerebhqv5b4', 'Small × 3', 2, 'cmsie8aqj00023qq9gnabt5nr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4500223qerhhiqg3kn', 'cmsms1p4500203qerebhqv5b4', 'cmslas9or00183q27cb6e4478', 3);
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
VALUES ('cmsms1p4s00433qer22r5z3bd', 'Small × 4', 2, 'cmsie8aqj00023qq9gnabt5nr', true, now(), now());
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
VALUES ('cmsms1p4s00453qer37fa9uk4', 'cmsms1p4s00433qer22r5z3bd', 'cmslas9or00183q27cb6e4478', 4);

-- 3) CourierConfig (full replace; new/empty table, nothing references it)
DELETE FROM "CourierConfig";
INSERT INTO "CourierConfig" (id, "weightSlab", "courierCompanyId", "courierCompanyServiceTypeId", label, priority, "createdAt", "updatedAt")
VALUES ('cmslj0u2v00013qgakjhxpj9r', '1kg', '2', '328', 'Delhivery Surface', 0, now(), now());
INSERT INTO "CourierConfig" (id, "weightSlab", "courierCompanyId", "courierCompanyServiceTypeId", label, priority, "createdAt", "updatedAt")
VALUES ('cmslj1l7i00033qgam4deg7gy', '1kg', '16', '333', 'DTDC Surface', 1, now(), now());
INSERT INTO "CourierConfig" (id, "weightSlab", "courierCompanyId", "courierCompanyServiceTypeId", label, priority, "createdAt", "updatedAt")
VALUES ('cmslj1xak00053qgafc79z6s5', '1kg', '6', '184', 'Xpressbess surface', 2, now(), now());
INSERT INTO "CourierConfig" (id, "weightSlab", "courierCompanyId", "courierCompanyServiceTypeId", label, priority, "createdAt", "updatedAt")
VALUES ('cmslj2lyn00073qgaibdmgr6h', '2kg', '2', '285', 'Delhivery Surface', 0, now(), now());
INSERT INTO "CourierConfig" (id, "weightSlab", "courierCompanyId", "courierCompanyServiceTypeId", label, priority, "createdAt", "updatedAt")
VALUES ('cmslj33tf00093qgawfncb6e9', '2kg', '16', '362', 'DTDC Surface', 1, now(), now());
INSERT INTO "CourierConfig" (id, "weightSlab", "courierCompanyId", "courierCompanyServiceTypeId", label, priority, "createdAt", "updatedAt")
VALUES ('cmslj3slh000b3qga6l0nc0jn', '2kg', '6', '341', 'Xpressbess surface', 2, now(), now());
INSERT INTO "CourierConfig" (id, "weightSlab", "courierCompanyId", "courierCompanyServiceTypeId", label, priority, "createdAt", "updatedAt")
VALUES ('cmslj4cfm000d3qga1lb7kw1n', '5kg', '2', '125', 'Delhivery Surface', 0, now(), now());
INSERT INTO "CourierConfig" (id, "weightSlab", "courierCompanyId", "courierCompanyServiceTypeId", label, priority, "createdAt", "updatedAt")
VALUES ('cmslj4s8l000f3qgaj5boa16v', '5kg', '16', '363', 'DTDC Surface', 1, now(), now());
INSERT INTO "CourierConfig" (id, "weightSlab", "courierCompanyId", "courierCompanyServiceTypeId", label, priority, "createdAt", "updatedAt")
VALUES ('cmslj5b9s000h3qgazhl6m8u2', '5kg', '6', '31', 'Xpressbess surface', 2, now(), now());

COMMIT;
