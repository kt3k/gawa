# gawa uses kotlinx.serialization through reified serializer<T>() lookups.
# Apps must keep the serializers of the types they pass through the bridge
# (the kotlinx.serialization Gradle plugin's rules cover @Serializable types).
