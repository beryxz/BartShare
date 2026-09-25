grammar Bart;

/* ------------------------------------------------------------------
 * DELIBERATE DEVIATIONS FROM THE PRINTED GRAMMAR (paper Tables 1-2)
 *
 * 1. Exchange 'and'/'or' precedence + parentheses. Table 1 gives no
 *    precedence/associativity (the paper never parses exchanges). We fix:
 *    'and' tighter than 'or', both left-associative, explicit '(' ')'
 *    always allowed to override.
 * 2. Context concrete form. Table 2's (Attribute*)+ vs the p.6 prose
 *    comma-separated tuple with '()' for an empty party list. We use the
 *    prose form.
 * 3. 'rules:()' is mandatory for a rule-less party (a parse error beats
 *    a silent null).
 * 4. 'Others' is parenthesized: 'from:(any:...)'. 'me'/'requester' stay bare.
 * 5. All string values are quoted (username:"john"). Bare tokens are ONLY
 *    numbers and booleans; keys and qnames stay bare NAMEs. A reserved word
 *    is therefore unusable as a key at any quoting, since ANTLR gives the
 *    implicit literal tokens priority over NAME: '(party:(to:"x"), rules:())'
 *    is a parse error, not an attribute named 'to'. Callers taking
 *    user-chosen attribute names have to reject the keyword list up front.
 * 6. Rule named 'policyRule' (not 'rule') to avoid ANTLR's generated
 *    RuleContext clashing with org.antlr.v4.runtime.RuleContext.
 * 7. Value cardinality / sets. Three forms: a bare atom is a scalar; a bare
 *    comma list of >=2 atoms is a collection; braces are always a collection,
 *    of any size including zero. '(k:"v")' is the scalar "v", '(k:{"v"})' the
 *    one-element collection ["v"], '(k:{})' the empty one. Both list forms
 *    build the same immutable java.util.List, so '(k:"a","b")' and
 *    '(k:{"a","b"})' are interchangeable under AttributeMatcher's equality.
 *    Element order is canonicalised at build time, so equal multisets build
 *    equal Lists and '(k:{"b","a"})' matches '(k:{"a","b"})'. Duplicates are
 *    kept and element types may be mixed, so these are bags: order-insensitive
 *    like the paper's sets, but '{"a","a"}' still differs from '{"a"}'.
 *    Sequences are consequently not expressible.
 *    Braces are legal only in attribute-value position -- 'x in {"a","b"}'
 *    inside a condition is still a parse error (future work).
 * 8. A typed value domain, and the type errors that follow from it. The paper
 *    leaves values underspecified ("booleans, numbers, strings, dates, and
 *    sets thereof"). We fix the domain to strings, numbers, booleans and sets
 *    of those, no dates, and type every literal at construction; numeric
 *    literals split into Long (integer) and Double (decimal) on the presence
 *    of a decimal point, a distinction the paper does not draw.
 *    An operator handed a value outside its domain therefore raises a type
 *    error that DENIES, naming the type in the trace, instead of degrading to
 *    false: 'in' over a non-set or with a set as its element, an ordering
 *    comparison ('<' '>' '<=' '>=') over anything but two atoms of the same
 *    type, and a non-boolean used as a condition. Fail-closed is the point,
 *    since a false would let 'not' negate
 *    a malformed condition into a permit. Only an operand that is actually
 *    evaluated counts: 'and'/'or' short-circuit, so an unreached ill-typed
 *    operand stays silent.
 *    Equality is the exception and spans the whole domain, so a cross-type '='
 *    answers a plain false. Sound for '"7" = 7', unsound for '7 = 7.0', where
 *    the Long/Double split makes one number two values and 'not' turns the
 *    falsehood into a permit. Attribute values carry the same typing
 *    ('(count:7)(ratio:1.5)' is legal .bart), and 'in' inherits the equality
 *    blindness through element equality.
 *
 * Implementation notes (not semantic): EOF-terminated *File entry rules
 * wrap EOF-free core rules so entries can be composed inside scenarioFile;
 * alternatives are labeled for a clean typed builder.
 * ------------------------------------------------------------------ */

// ---- entry rules (EOF-terminated) --------------------------------
scenarioFile        : policySystem context enrichedRequest EOF ;
policySystemFile    : policySystem EOF ;
policyFile          : policy EOF ;
contextFile          : context EOF ;
enrichedRequestFile : enrichedRequest EOF ;

// ---- core rules (Table 1) ----------------------------------------
policySystem : policy+ ;
policy       : '(' 'party' ':' attribute+ ',' 'rules' ':' rules ')' ;
rules        : '(' ')'   # EmptyRules
             | policyRule+ # NonEmptyRules
             ;
policyRule   : '(' 'resource' ':' attribute+
                   (',' 'condition' ':' expr)?
                   (',' 'exchange' ':' exchange)? ')' ;

exchange : '(' inner=exchange ')'                        # ParenExchange
         | left=exchange 'and' right=exchange            # AndExchange
         | left=exchange 'or'  right=exchange            # OrExchange
         | '(' 'to' ':' to ',' 'resource' ':' attribute+ ',' 'from' ':' from ')'  # SingleExchange
         ;

to   : 'me'        # ToMe
     | others      # ToOthers
     ;
from : 'requester' # FromRequester
     | others      # FromOthers
     ;
others : '(' quant=('any'|'all') ':' attribute* ')' ;

request         : '(' 'resource' ':' attribute+ ',' 'from' ':' others ')' ;
enrichedRequest : NUMBER ':' request ;

// ---- attributes & context ----------------------------------------
attribute : '(' NAME ':' value ')' ;
value     : atom                           # ScalarValue
          | atom (',' atom)+               # BareListValue
          | '{' (atom (',' atom)*)? '}'    # SetValue
          ;
atom      : STRING   # StringAtom
          | NUMBER   # NumberAtom
          | BOOL     # BoolAtom
          ;
context  : '(' attrList (',' attrList)* ')' ;
attrList : '(' ')'      # EmptyAttrList
         | attribute+   # NonEmptyAttrList
         ;

// ---- Expr: tightest alternative first ----------------------------
expr : '(' inner=expr ')'                                    # ParenExpr
     | element=expr 'in' set=qname                           # InExpr
     | left=expr op=('='|'!='|'<'|'>'|'<='|'>=') right=expr  # CmpExpr
     | 'not' inner=expr                                      # NotExpr
     | left=expr 'and' right=expr                            # AndExpr
     | left=expr 'or'  right=expr                            # OrExpr
     | qname                                                 # NameExpr
     | atom                                                  # LitExpr
     ;

qname : NAME                    # SimpleName
      | 'requester' '.' NAME    # RequesterName
      | attribute+ '.' NAME     # PartyName
      ;

// ---- lexer -------------------------------------------------------
BOOL    : 'true' | 'false' ;
NUMBER  : '-'? [0-9]+ ('.' [0-9]+)? ;
NAME    : [a-zA-Z_] [a-zA-Z_0-9]* ;
STRING  : '"' (~["\\] | '\\' .)* '"' ;
COMMENT : '#' ~[\r\n]* -> skip ;
WS      : [ \t\r\n]+ -> skip ;
