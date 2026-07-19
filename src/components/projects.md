# projects

<script &&>
  return projects
      .map((p) => {
          const tags =
              typeof p.tags === "string"
                  ? [p.tags]
                  : Array.isArray(p.tags)
                      ? p.tags
                      : [];
          return c.project({...p, tags});
      })
      .join("\n");
</script>
