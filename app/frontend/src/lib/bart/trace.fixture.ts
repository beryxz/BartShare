/**
 * The trace `StudentsExampleTest` asserts for the paper's Fig. 2 scenario.
 * Verbatim: it is the parser's oracle, so it must not be tidied or reformatted.
 */
export const STUDENTS_TRACE = `evaluating Request[requester=1, resource=[(type : lectureNotes), (course : ads)], from=any: [(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)]]
  finding matching policies
    policy 2: from match([(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)], [(username : mary), (studyLevel : undergraduate), (degreeProgram : cs), (university : unifi), (enrollment : 2023)]) -> true
  policy 2: evaluating Request[requester=1, resource=[(type : lectureNotes), (course : ads)], from=2]
    rule 2.1: resource match([(type : lectureNotes), (course : ads)], [(type : lectureNotes), (course : ads), (teacher : doe), (year : 23/24)]) -> true
    rule 2.1: condition true -> true
    rule 2.1: evaluating OR(Exchange[to=ME, resource=[(type : exercises)], from=REQUESTER], Exchange[to=ME, resource=[(type : lectureNotes)], from=REQUESTER])
      rule 2.1: evaluating Exchange[to=ME, resource=[(type : exercises)], from=REQUESTER]
      evaluating Request[requester=2, resource=[(type : exercises)], from=1]
        policy 1: evaluating Request[requester=2, resource=[(type : exercises)], from=1]
          rule 1.1: resource match([(type : exercises)], [(type : lectureNotes), (course : programming), (teacher : smith), (year : 24/25)]) -> false
        policy 1: evaluating Request[requester=2, resource=[(type : exercises)], from=1]
          rule 1.2: resource match([(type : exercises)], [(type : exercises), (course : programming), (year : 24/25)]) -> true
          rule 1.2: condition requester.username in friends -> false
      result: false
    rule 2.1: OR
      rule 2.1: evaluating Exchange[to=ME, resource=[(type : lectureNotes)], from=REQUESTER]
      evaluating Request[requester=2, resource=[(type : lectureNotes)], from=1]
        policy 1: evaluating Request[requester=2, resource=[(type : lectureNotes)], from=1]
          rule 1.1: resource match([(type : lectureNotes)], [(type : lectureNotes), (course : programming), (teacher : smith), (year : 24/25)]) -> true
          rule 1.1: condition true -> true
      result: true
    rule 2.1: END Exchange -> true
result: true
`;

/**
 * The same example with an `and` exchange across three parties: the AND
 * connector, sibling `result:` nodes at one depth, the `compliant request
 * found` cycle break, and `policy N: from match` at exchange depth.
 */
export const STUDENTS_AND_TRACE = `evaluating Request[requester=1, resource=[(type : lectureNotes), (course : ads)], from=any: [(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)]]
  finding matching policies
    policy 2: from match([(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)], [(username : mary), (studyLevel : undergraduate), (degreeProgram : cs), (university : unifi), (enrollment : 2023)]) -> true
    policy 3: from match([(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)], [(username : david), (studyLevel : undergraduate), (degreeProgram : cs), (university : unifi), (enrollment : 2023)]) -> true
  policy 2: evaluating Request[requester=1, resource=[(type : lectureNotes), (course : ads)], from=2]
    rule 2.1: resource match([(type : lectureNotes), (course : ads)], [(type : lectureNotes), (course : ads), (teacher : doe), (year : 23/24)]) -> true
    rule 2.1: condition true -> true
    rule 2.1: evaluating AND(Exchange[to=ME, resource=[(type : lectureNotes)], from=any: [(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)]], Exchange[to=ME, resource=[(type : exercises)], from=any: [(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)]])
      rule 2.1: evaluating Exchange[to=ME, resource=[(type : lectureNotes)], from=any: [(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)]]
      policy 1: from match([(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)], [(username : john), (studyLevel : undergraduate), (degreeProgram : cs), (university : unifi), (enrollment : 2024)]) -> true
      policy 2: from match([(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)], [(username : mary), (studyLevel : undergraduate), (degreeProgram : cs), (university : unifi), (enrollment : 2023)]) -> true
      policy 3: from match([(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)], [(username : david), (studyLevel : undergraduate), (degreeProgram : cs), (university : unifi), (enrollment : 2023)]) -> true
      evaluating Request[requester=2, resource=[(type : lectureNotes)], from=1]
        policy 1: evaluating Request[requester=2, resource=[(type : lectureNotes)], from=1]
          rule 1.1: resource match([(type : lectureNotes)], [(type : lectureNotes), (course : programming), (teacher : smith), (year : 24/25)]) -> true
          rule 1.1: condition true -> true
          rule 1.1: evaluating Exchange[to=ME, resource=[(type : lectureNotes)], from=REQUESTER]
          rule 1.1: compliant request found Request[requester=1, resource=[(type : lectureNotes)], from=2]
      result: true
    rule 2.1: AND
      rule 2.1: evaluating Exchange[to=ME, resource=[(type : exercises)], from=any: [(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)]]
      policy 1: from match([(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)], [(username : john), (studyLevel : undergraduate), (degreeProgram : cs), (university : unifi), (enrollment : 2024)]) -> true
      policy 2: from match([(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)], [(username : mary), (studyLevel : undergraduate), (degreeProgram : cs), (university : unifi), (enrollment : 2023)]) -> true
      policy 3: from match([(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)], [(username : david), (studyLevel : undergraduate), (degreeProgram : cs), (university : unifi), (enrollment : 2023)]) -> true
      evaluating Request[requester=2, resource=[(type : exercises)], from=1]
        policy 1: evaluating Request[requester=2, resource=[(type : exercises)], from=1]
          rule 1.1: resource match([(type : exercises)], [(type : lectureNotes), (course : programming), (teacher : smith), (year : 24/25)]) -> false
        policy 1: evaluating Request[requester=2, resource=[(type : exercises)], from=1]
          rule 1.2: resource match([(type : exercises)], [(type : exercises), (course : programming), (year : 24/25)]) -> true
          rule 1.2: condition requester.username in friends -> false
      result: false
      evaluating Request[requester=2, resource=[(type : exercises)], from=3]
        policy 3: evaluating Request[requester=2, resource=[(type : exercises)], from=3]
          rule 3.1: resource match([(type : exercises)], [(type : exercises), (course : calculus), (teacher : brown), (year : 23/24)]) -> true
          rule 3.1: condition true -> true
      result: true
    rule 2.1: END Exchange -> true
result: true
`;

/**
 * The only root-level denial here, and what the diagram model is built against:
 * a quantified fan where `any` does not short-circuit, consecutive duplicate
 * `policy 2` nodes that must collapse to one arrow, a nested failed exchange
 * with its own `result: false`, and `(userId : …)` party attributes.
 *
 * Party order is 1 david, 2 john, 3 mary, the reverse of the paper fixtures:
 * indexes are per-request closure order, never global.
 */
export const STUDENTS_DENY_TRACE = `evaluating Request[requester=1, resource=[(type : lectureNotes), (course : programming)], from=any: [(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)]]
  finding matching policies
    policy 2: from match([(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)], [(userId : 52a9d498-1b42-4503-9bf3-8f0dfbf60479), (username : john), (studyLevel : undergraduate), (degreeProgram : cs), (university : unifi), (enrollment : 2024)]) -> true
    policy 3: from match([(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)], [(userId : b444e8de-3f02-4d56-8856-cefdfbf9501e), (username : mary), (studyLevel : undergraduate), (degreeProgram : cs), (university : unifi), (enrollment : 2023)]) -> true
  policy 2: evaluating Request[requester=1, resource=[(type : lectureNotes), (course : programming)], from=2]
    rule 2.1: resource match([(type : lectureNotes), (course : programming)], [(type : lectureNotes), (course : programming), (teacher : smith), (year : 24/25)]) -> true
    rule 2.1: condition true -> true
    rule 2.1: evaluating Exchange[to=ME, resource=[(type : lectureNotes)], from=REQUESTER]
    evaluating Request[requester=2, resource=[(type : lectureNotes)], from=1]
      policy 1: evaluating Request[requester=2, resource=[(type : lectureNotes)], from=1]
        rule 1.1: resource match([(type : lectureNotes)], [(type : exercises), (course : calculus), (teacher : brown), (year : 23/24)]) -> false
    result: false
  policy 2: evaluating Request[requester=1, resource=[(type : lectureNotes), (course : programming)], from=2]
    rule 2.2: resource match([(type : lectureNotes), (course : programming)], [(type : exercises), (course : programming), (year : 24/25)]) -> false
  policy 3: evaluating Request[requester=1, resource=[(type : lectureNotes), (course : programming)], from=3]
    rule 3.1: resource match([(type : lectureNotes), (course : programming)], [(type : lectureNotes), (course : ads), (teacher : doe), (year : 23/24)]) -> false
result: false
`;

/**
 * A swallowed condition exception, with the erroring rule as the LAST attempt:
 * the message lands where a boolean would go. That exact ordering is the
 * regression, since the rule's earlier `resource match -> true` can otherwise
 * stand as `subtreeOutcome`'s last word and paint a denied arrow green. A later
 * attempt hides it, hence `CONDITION_ERROR_THEN_MISS_TRACE`.
 */
export const CONDITION_ERROR_TRACE = `evaluating Request[requester=1, resource=[(test : 1)], from=any: [(userId : 607fb26e-4031-45a9-afe0-2a0e498a27e8)]]
  finding matching policies
    policy 2: from match([(userId : 607fb26e-4031-45a9-afe0-2a0e498a27e8)], [(userId : 607fb26e-4031-45a9-afe0-2a0e498a27e8), (username : david)]) -> true
  policy 2: evaluating Request[requester=1, resource=[(test : 1)], from=2]
    rule 2.1: resource match([(test : 1)], [(type : exercises), (course : calculus), (teacher : brown), (year : 23/24)]) -> false
  policy 2: evaluating Request[requester=1, resource=[(test : 1)], from=2]
    rule 2.2: resource match([(test : 1)], [(test : 2)]) -> false
  policy 2: evaluating Request[requester=1, resource=[(test : 1)], from=2]
    rule 2.3: resource match([(test : 1)], [(test : 1)]) -> true
    rule 2.3: condition testGroup in requester.groups -> Undefined name: testGroup
result: false
`;

/**
 * `CONDITION_ERROR_TRACE` with one more rule attempted after the erroring one.
 * Rule 2.4's `resource match -> false` supplies a later boolean, so this shape
 * always drew correctly; kept as the guard on the other fixture's fix.
 */
export const CONDITION_ERROR_THEN_MISS_TRACE = `evaluating Request[requester=1, resource=[(test : 1)], from=any: [(userId : 607fb26e-4031-45a9-afe0-2a0e498a27e8)]]
  finding matching policies
    policy 2: from match([(userId : 607fb26e-4031-45a9-afe0-2a0e498a27e8)], [(userId : 607fb26e-4031-45a9-afe0-2a0e498a27e8), (username : david), (enrollment : 2023), (studyLevel : undergraduate), (university : unifi), (degreeProgram : cs)]) -> true
  policy 2: evaluating Request[requester=1, resource=[(test : 1)], from=2]
    rule 2.1: resource match([(test : 1)], [(type : exercises), (course : calculus), (teacher : brown), (year : 23/24)]) -> false
  policy 2: evaluating Request[requester=1, resource=[(test : 1)], from=2]
    rule 2.2: resource match([(test : 1)], [(test : 2)]) -> false
  policy 2: evaluating Request[requester=1, resource=[(test : 1)], from=2]
    rule 2.3: resource match([(test : 1)], [(test : 1)]) -> true
    rule 2.3: condition testGroup in requester.groups -> Undefined name: testGroup
  policy 2: evaluating Request[requester=1, resource=[(test : 1)], from=2]
    rule 2.4: resource match([(test : 1)], [(teacher : brown)]) -> false
result: false
`;

/**
 * Mary's AND exchange pulls in john, whose own rule demands lectureNotes back,
 * which recurses into mary's *same* rule one level deeper until the
 * vicious-circle break closes the loop. Frame shape `[[2,'and'], [3,'single'],
 * [2,'and']]`: the third frame is mary's AND again, not an unrelated exchange.
 *
 * Carries a cause chip on a refusal inside a frame at two depths, and a
 * candidate fan whose `matched` set includes the searching party.
 */
export const SEEDED_EXCHANGE_TRACE = `evaluating Request[requester=1, resource=[(type : lectureNotes), (course : ads), (teacher : doe), (year : 23/24)], from=any: [(userId : 1b924ec8-636f-4b40-98f7-af53d9ec644e)]]
  finding matching policies
    policy 2: from match([(userId : 1b924ec8-636f-4b40-98f7-af53d9ec644e)], [(userId : 1b924ec8-636f-4b40-98f7-af53d9ec644e), (username : mary), (studyLevel : undergraduate), (degreeProgram : cs), (university : unifi), (enrollment : 2023)]) -> true
    policy 3: from match([(userId : 1b924ec8-636f-4b40-98f7-af53d9ec644e)], [(userId : f80a44ba-0ea7-4dca-884b-0f14331032a4), (username : john), (studyLevel : undergraduate), (degreeProgram : cs), (university : unifi), (enrollment : 2024)]) -> false
  policy 2: evaluating Request[requester=1, resource=[(type : lectureNotes), (course : ads), (teacher : doe), (year : 23/24)], from=2]
    rule 2.1: resource match([(type : lectureNotes), (course : ads), (teacher : doe), (year : 23/24)], [(type : lectureNotes), (course : ads), (teacher : doe), (year : 23/24)]) -> true
    rule 2.1: condition true -> true
    rule 2.1: evaluating AND(Exchange[to=ME, resource=[(type : lectureNotes)], from=any: [(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)]], Exchange[to=ME, resource=[(type : exercises)], from=any: [(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)]])
      rule 2.1: evaluating Exchange[to=ME, resource=[(type : lectureNotes)], from=any: [(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)]]
      policy 1: from match([(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)], [(userId : f768788b-3d6d-4a0a-a2d4-42d140c108b5), (username : david), (studyLevel : undergraduate), (degreeProgram : cs), (university : unifi), (enrollment : 2023)]) -> true
      policy 2: from match([(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)], [(userId : 1b924ec8-636f-4b40-98f7-af53d9ec644e), (username : mary), (studyLevel : undergraduate), (degreeProgram : cs), (university : unifi), (enrollment : 2023)]) -> true
      policy 3: from match([(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)], [(userId : f80a44ba-0ea7-4dca-884b-0f14331032a4), (username : john), (studyLevel : undergraduate), (degreeProgram : cs), (university : unifi), (enrollment : 2024)]) -> true
      evaluating Request[requester=2, resource=[(type : lectureNotes)], from=1]
        policy 1: evaluating Request[requester=2, resource=[(type : lectureNotes)], from=1]
          rule 1.1: resource match([(type : lectureNotes)], [(type : exercises), (course : calculus), (teacher : brown), (year : 23/24)]) -> false
      result: false
      evaluating Request[requester=2, resource=[(type : lectureNotes)], from=3]
        policy 3: evaluating Request[requester=2, resource=[(type : lectureNotes)], from=3]
          rule 3.1: resource match([(type : lectureNotes)], [(type : lectureNotes), (course : programming), (teacher : smith), (year : 24/25)]) -> true
          rule 3.1: condition true -> true
          rule 3.1: evaluating Exchange[to=ME, resource=[(type : lectureNotes)], from=REQUESTER]
          evaluating Request[requester=3, resource=[(type : lectureNotes)], from=2]
            policy 2: evaluating Request[requester=3, resource=[(type : lectureNotes)], from=2]
              rule 2.1: resource match([(type : lectureNotes)], [(type : lectureNotes), (course : ads), (teacher : doe), (year : 23/24)]) -> true
              rule 2.1: condition true -> true
              rule 2.1: evaluating AND(Exchange[to=ME, resource=[(type : lectureNotes)], from=any: [(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)]], Exchange[to=ME, resource=[(type : exercises)], from=any: [(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)]])
                rule 2.1: evaluating Exchange[to=ME, resource=[(type : lectureNotes)], from=any: [(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)]]
                policy 1: from match([(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)], [(userId : f768788b-3d6d-4a0a-a2d4-42d140c108b5), (username : david), (studyLevel : undergraduate), (degreeProgram : cs), (university : unifi), (enrollment : 2023)]) -> true
                policy 2: from match([(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)], [(userId : 1b924ec8-636f-4b40-98f7-af53d9ec644e), (username : mary), (studyLevel : undergraduate), (degreeProgram : cs), (university : unifi), (enrollment : 2023)]) -> true
                policy 3: from match([(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)], [(userId : f80a44ba-0ea7-4dca-884b-0f14331032a4), (username : john), (studyLevel : undergraduate), (degreeProgram : cs), (university : unifi), (enrollment : 2024)]) -> true
                evaluating Request[requester=2, resource=[(type : lectureNotes)], from=1]
                  policy 1: evaluating Request[requester=2, resource=[(type : lectureNotes)], from=1]
                    rule 1.1: resource match([(type : lectureNotes)], [(type : exercises), (course : calculus), (teacher : brown), (year : 23/24)]) -> false
                result: false
                rule 2.1: compliant request found Request[requester=2, resource=[(type : lectureNotes)], from=3]
              rule 2.1: AND
                rule 2.1: evaluating Exchange[to=ME, resource=[(type : exercises)], from=any: [(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)]]
                policy 1: from match([(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)], [(userId : f768788b-3d6d-4a0a-a2d4-42d140c108b5), (username : david), (studyLevel : undergraduate), (degreeProgram : cs), (university : unifi), (enrollment : 2023)]) -> true
                policy 2: from match([(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)], [(userId : 1b924ec8-636f-4b40-98f7-af53d9ec644e), (username : mary), (studyLevel : undergraduate), (degreeProgram : cs), (university : unifi), (enrollment : 2023)]) -> true
                policy 3: from match([(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)], [(userId : f80a44ba-0ea7-4dca-884b-0f14331032a4), (username : john), (studyLevel : undergraduate), (degreeProgram : cs), (university : unifi), (enrollment : 2024)]) -> true
                evaluating Request[requester=2, resource=[(type : exercises)], from=1]
                  policy 1: evaluating Request[requester=2, resource=[(type : exercises)], from=1]
                    rule 1.1: resource match([(type : exercises)], [(type : exercises), (course : calculus), (teacher : brown), (year : 23/24)]) -> true
                    rule 1.1: condition true -> true
                result: true
              rule 2.1: END Exchange -> true
          result: true
      result: true
    rule 2.1: AND
      rule 2.1: evaluating Exchange[to=ME, resource=[(type : exercises)], from=any: [(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)]]
      policy 1: from match([(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)], [(userId : f768788b-3d6d-4a0a-a2d4-42d140c108b5), (username : david), (studyLevel : undergraduate), (degreeProgram : cs), (university : unifi), (enrollment : 2023)]) -> true
      policy 2: from match([(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)], [(userId : 1b924ec8-636f-4b40-98f7-af53d9ec644e), (username : mary), (studyLevel : undergraduate), (degreeProgram : cs), (university : unifi), (enrollment : 2023)]) -> true
      policy 3: from match([(studyLevel : undergraduate), (degreeProgram : cs), (university : unifi)], [(userId : f80a44ba-0ea7-4dca-884b-0f14331032a4), (username : john), (studyLevel : undergraduate), (degreeProgram : cs), (university : unifi), (enrollment : 2024)]) -> true
      evaluating Request[requester=2, resource=[(type : exercises)], from=1]
        policy 1: evaluating Request[requester=2, resource=[(type : exercises)], from=1]
          rule 1.1: resource match([(type : exercises)], [(type : exercises), (course : calculus), (teacher : brown), (year : 23/24)]) -> true
          rule 1.1: condition true -> true
      result: true
    rule 2.1: END Exchange -> true
result: true
`;

/**
 * A permit decided by the rule after a failed barter, captured from the
 * imagery scenario: rule 2.1 matches the resource but its exchange fails, and
 * rule 2.2 then grants on a condition. The merged policy arrow must name rule
 * 2.2 as the granting rule while the drawn frame belongs to rule 2.1.
 */
export const SECOND_RULE_GRANT_TRACE = `evaluating Request[requester=1, resource=[(band : infrared), (type : imagery), (region : alps), (resolution : 10)], from=any: [(userId : 9791cdf1-7e49-4e28-8df1-ea7ee02c57ba)]]
  finding matching policies
    policy 2: from match([(userId : 9791cdf1-7e49-4e28-8df1-ea7ee02c57ba)], [(userId : 9791cdf1-7e49-4e28-8df1-ea7ee02c57ba), (kind : agency), (country : it), (program : copernicus), (username : italsat)]) -> true
  policy 2: evaluating Request[requester=1, resource=[(band : infrared), (type : imagery), (region : alps), (resolution : 10)], from=2]
    rule 2.1: resource match([(band : infrared), (type : imagery), (region : alps), (resolution : 10)], [(type : imagery), (region : alps), (band : infrared), (resolution : 10)]) -> true
    rule 2.1: condition true -> true
    rule 2.1: evaluating Exchange[to=ME, resource=[(type : imagery), (region : coast), (band : optical)], from=REQUESTER]
    evaluating Request[requester=2, resource=[(type : imagery), (region : coast), (band : optical)], from=1]
      policy 1: evaluating Request[requester=2, resource=[(type : imagery), (region : coast), (band : optical)], from=1]
        rule 1.1: resource match([(type : imagery), (region : coast), (band : optical)], [(type : aerial), (region : alps), (band : optical), (resolution : 1)]) -> false
    result: false
  policy 2: evaluating Request[requester=1, resource=[(band : infrared), (type : imagery), (region : alps), (resolution : 10)], from=2]
    rule 2.2: resource match([(band : infrared), (type : imagery), (region : alps), (resolution : 10)], [(type : imagery), (region : alps), (band : infrared), (resolution : 10)]) -> true
    rule 2.2: condition requester.userId in connections -> true
result: true
`;
